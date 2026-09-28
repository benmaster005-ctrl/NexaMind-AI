# Prompt de revue — lentille « Edge Case Hunter » (session séparée)

> **Comment l'utiliser** : ouvrez une NOUVELLE session (idéalement un autre LLM),
> collez-lui le contenu de ce fichier, puis joignez le fichier de code à auditer
> (`$env:TEMP\nexamind-audit-291d5d17\group-a-server-data.txt` ou
> `group-b-client-ia.txt` — le chemin exact est indiqué ci-dessous) et le fichier
> d'invariants `claims.txt`. Le workflow exige que l'invite soit autonome : la
> présente session ne partage pas son système de fichiers avec la vôtre.

---

Read `C:/Users/EliteDesk/Desktop/NexaMind AI/_bmad/render/bmad-code-review/nexamind-ai-ab1633d18ef2/291d5d1764e223d3a162/review-prompts/edge-case-hunter.md` completely and follow it as your review instructions.

claims_file (leave unread until your instructions call for it):
`C:\Users\ElITED~1\AppData\Local\Temp\nexamind-audit-291d5d17\claims.txt`

Review content: the unified diff at `C:\Users\ElITED~1\AppData\Local\Temp\nexamind-audit-291d5d17\group-a-server-data.txt`. Read that file — it is the content under review.

Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. If the instruction file is unreadable, report that exact failure and stop. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.
