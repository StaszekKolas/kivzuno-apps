# KIVZUNO — bezpieczna stała kolejka Buffer (Free)

## Cel

Jeden wielokrotnego użytku proces: **agent bada rynek → tworzy propozycję treści w Draft PR → właściciel akceptuje zatwierdzoną, gotową aplikację i materiały → GitHub cyklicznie przekazuje wyłącznie te materiały do kolejki Buffer Free → osobny odczyt statusu SENT i analityka**.

W przeciwieństwie do jednorazowej kampanii Panic Button z 9 października, te wpisy używają `mode: addToQueue`, a nie `shareNow`. Buffer ustala daty publikacji według własnych ustawionych przez użytkownika slotów (nie według godziny wywołania GitHub).

## Stan uruchomienia

- `content/buffer/approved.json` ma obecnie **0 zatwierdzonych kampanii**. Starej kampanii Panic Button nie kopiujemy drugi raz.
- Ten system jest dopiero w osobnym **Draft PR**. Niczego jeszcze nie zaplanowano i nie opublikowano.
- Po osobnym zatwierdzeniu **merge do main** automatyzacja nadal nie wykonuje zapisów do Buffer, dopóki właściciel sam jawnie nie ustawi zmiennej GitHub Actions `BUFFER_AUTOPUBLISH_ENABLED=true`. Nie włączaj jej na etapie PR.
- Istniejący GitHub Secret `BUFFER_API_KEY` pozostaje nienaruszony.
- GitHub cron: `15 10 * * *` w **UTC** (11:15 UK latem; 10:15 UK zimą), teoretyczna godzina uruchomienia; GitHub może opóźnić zaplanowane uruchomienia. Jedno uruchomienie dziennie, max 1 nowe wideo/kanał.
- Darmowy limit Buffer: maksymalnie **10 postów oczekujących/kanał**, a skrypt wstrzymuje dodawanie przy **9**. Nie ma płatnego „first comment”, reklam, zakupów, płatnego planu, Stripe Live ani kodu publikującego do kanałów innych niż Instagram/Facebook/TikTok KIVZUNO.
- Materiały wideo muszą być publicznymi, zaakceptowanymi przez właściciela MP4 pod `static.metricool.com` albo `kivzuno-hub.netlify.app`. Oryginalne prawa do mediów muszą być sprawdzone osobno.
- Tylko wpisy o znaczniku `ownerApproved=true`, odnośniku do PR zatwierdzenia, `releaseVerified=true`, production commit SHA, oknie publikacji i źródłach ruchu `ig_reel/fb_reel/tiktok` przechodzą walidację. Agent **nie może sam scalać** takich PR do main. Gdy brak zgody, nie dodaje nic do `approved.json` na main.

## Dopisywanie kampanii

1. Agent `KIVZUNO | Produkty` i `KIVZUNO | Buffer + marketing` badają rzeczywiste wyniki i trendy; proponują koncept i kreatywne warianty (format 9:16, opis EN, CTA dla każdego kanału, legalne media). **To nie jest autonomiczne nadawanie zgody**.
2. Produkt docelowy musi być zatwierdzony, scalony, udostępniony publicznie przez Netlify, mieć potwierdzony production commit i manualny test realnej rozgrywki. Zapisz konkretny commit i dowód w PR.
3. W **nowym PR**, nie na main, skopiuj jeden wpis z `content/buffer/example.template.json` do `content/buffer/approved.json`, podmień całe teksty i MP4 na rzeczywiste zatwierdzone materiały, ustaw `ownerApproved=true` i `releaseVerified=true` tylko po wyraźnej zgodzie użytkownika, realny `approvalPr` i `productionCommit`.
4. GitHub CI `KIVZUNO approved Buffer queue` musi zaliczyć wszystkie testy i statyczną walidację. Netlify live probe w skrypcie dodatkowo sprawdzi stronę bezpośrednio przed ewentualnym dodaniem do kolejki. Sam taki smoke test nie zastępuje testu gry i płatności.
5. Właściciel sprawdza **wszystkie** napisy, linki, kadry, AI labels, zgody i limity. Wyraźnie zatwierdza merge. **Dopiero po merge** kampania staje się kandydatem do automatycznej synchronizacji.
6. Aktywację zmiennej `BUFFER_AUTOPUBLISH_ENABLED=true` zrobić **wyłącznie po osobnej, wyraźnej zgodzie**, najlepiej po pierwszym próbnym wykonaniu `workflow_dispatch → inspect` i weryfikacji pustych/pełnych kolejek. Ta zmienna NIE jest sekretem, a klucz API pozostaje GitHub Secret.
7. Bezpieczna synchronizacja sprawdzi historię Buffer we wszystkich statusach `draft,error,needs_approval,scheduled,sending,sent`, odmówi pracy, jeśli historia niekompletna lub konto niejednoznaczne, uwzględni limit miejsc, zweryfikuje publiczny hub i wszystkie MP4, a potem doda nie więcej niż 1 post na kanał w danym przebiegu.
8. Post `scheduled` znaczy umieszczony w kolejce, **nie** opublikowany. Dopiero `sent` i/lub publiczny odnośnik potwierdza dotarcie do platformy. Przy błędzie częściowym nie ponawiaj ręcznie na ślepo.

## Ręczna inspekcja bez publikacji

Po merge: GitHub → Actions → **KIVZUNO approved Buffer queue** → Run workflow → `main` → `mode=inspect`. Taka inspekcja nic nie publikuje i działa również bez włączonej zmiennej auto-publishing. Uruchomienie `mode=queue` jest blokowane przy braku `BUFFER_AUTOPUBLISH_ENABLED=true`.

## Ograniczenia

- W repo nie ma sztucznej inteligencji, która sama tworzy/akceptuje/merge'uje nowe kampanie. Agent dostarcza propozycje w harmonogramie ChatGPT, dopiero ich zatwierdzenie może prowadzić do wypełnienia manifestu.
- Źródła dzisiejszej kampanii Panic Button i odrębne archiwalne workflow należy zachować do audytu, **nie** uruchamiać ponownie.
- GitHub Actions i Buffer mogą opóźniać wykonywanie; obie platformy mają bezpłatne limity. Godzina crona to moment dodania do kolejki, nie godzina emisji posta. Ustaw realny harmonogram kolejki osobno w Buffer.
- Pełna idempotencja przez odczyt historii Buffer jest silnym ograniczeniem duplikatów, ale jeśli Buffer zapisał post i przez awarię API jeszcze go nie raportuje, ponowienie może wymagać ręcznej kontroli. Dzienny odstęp zmniejsza to ryzyko, nie daje gwarancji.
- Manifest może blokować się na pojedynczym wpisie z nieprawidłowym medium lub wygasłą aprobatą; jest to zamierzony **fail closed**, a nie zaproszenie do obchodzenia zabezpieczeń.
