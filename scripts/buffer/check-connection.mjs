// Read-only Buffer connectivity check: no GraphQL mutations, no publishing.
// Never commit or print BUFFER_API_KEY; store it only as a GitHub Actions secret.
const token = process.env.BUFFER_API_KEY;
if (!token || !token.trim()) {
  console.error('FAIL: BUFFER_API_KEY repository secret is missing');
  process.exit(1);
}

async function query(graphql) {
  const response = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token.trim(),
    },
    body: JSON.stringify({ query: graphql }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Buffer API HTTP ' + response.status);
  const result = await response.json();
  if (result.errors?.length) throw new Error('Buffer GraphQL error (' + result.errors.length + ')');
  if (!result.data) throw new Error('Buffer returned no data');
  return result.data;
}

try {
  // Official documented Buffer GraphQL queries. No posts or private data requested.
  const result = await query('query GetOrganizations { account { organizations { id } } }');
  const organizations = result.account?.organizations;
  if (!Array.isArray(organizations) || organizations.length === 0) {
    throw new Error('No Buffer organizations found');
  }

  const services = [];
  for (const organization of organizations) {
    if (typeof organization.id !== 'string' || !organization.id) {
      throw new Error('Invalid organization');
    }
    const channelsResult = await query(
      'query GetChannels { channels(input: { organizationId: ' +
      JSON.stringify(organization.id) + ' }) { id service } }'
    );
    if (!Array.isArray(channelsResult.channels)) {
      throw new Error('Channel list unavailable');
    }
    for (const channel of channelsResult.channels) {
      if (typeof channel?.service === 'string') services.push(channel.service.toLowerCase());
    }
  }

  let complete = true;
  for (const service of ['instagram', 'facebook', 'tiktok']) {
    const count = services.filter((entry) => entry === service).length;
    console.log(service + ': ' + count + ' connected channel(s)');
    if (count === 0) complete = false;
  }
  if (!complete) throw new Error('Not all three platforms found in Buffer');
  console.log('PASS: API connected; IG, Facebook, TikTok detected. NO POSTS CREATED.');
} catch (error) {
  // Never print key, request headers or full Buffer responses.
  console.error('FAIL: ' + error.message);
  process.exitCode = 1;
}
