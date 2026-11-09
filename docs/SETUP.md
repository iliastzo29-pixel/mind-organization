# Setup questions

Mind Organization asks these questions when a vault is opened for the first time. Generated from `plugin/setup.js`.

## Round 1 · in Obsidian, no AI needed

### Welcome to Mind Organization

A few questions set up your vault. Nothing leaves this computer. You can change everything later, or run these questions again from the command palette.

- Your name
- Country you live and work in (laws and taxes are checked for this country)
- What do you want to organize?: *Small company / startup*, *Freelancer / self-employed*, *Personal life*, *Studies, research or a creative project*
- Which AI model will you connect?: *Not yet*, *Claude*, *DeepSeek*, *Gemini*, *Grok*, *A local model*, *Other*
- Folder for your vault
- Optional: show a live market ticker on the start page (S&P 500, Nasdaq, Bitcoin, gold). It loads a TradingView widget and needs internet.

### Your company (only if chosen)

The Control Room and the Project Owner are built around these answers.

- Company or project name
- What do you sell, and to whom?
- Where are you today?: *Only an idea*, *Preparing the first sale*, *Already selling*
- Legal form: *Not decided yet*, *Sole trader*, *Limited company*, *Other*
- The one goal for the next six months
- By when? (DD.MM.YYYY, optional)

### Your freelance work (only if chosen)

- What service do you offer?
- Who pays you? (type of client)
- How do you charge?: *Per hour*, *Per project*, *Monthly retainer*, *Not decided yet*
- The one goal for the next six months

### Your personal life (only if chosen)

- Set up My Daily (today, routine, goals, check-ins)
- Set up My Economy (income, expenses, savings, debts)
- Currency
- One habit you want to keep
- One personal goal for this year

### Your studies, research or creative project (only if chosen)

- Topic or project
- What kind?: *Studies*, *Research*, *Creative project*
- Your main books or sources (one per line)
- Next important date (exam, hand-in, release), DD.MM.YYYY, optional

### The rules your agents follow

These rules are written into Rules.md. Every agent reads them first.

- Agents prepare, I decide. Nothing is sent, paid or deleted without my approval.
- Facts only with a source. Estimates are marked 🟡.
- Laws and taxes only from official sources, never from memory.
- Every decision, deadline and email is written back into the vault the same day.

## Round 2 · the AI interview

Written into `Setup/AI Interview.md` with the projects you chose. Shown here for all four projects.


Give this note to your AI model (Claude, DeepSeek, Gemini, Grok or a local model) once it is connected.
If the model can read this vault, paste only this note. If it cannot, paste this note together with `Setup/Answers.md` and `Rules.md`, and copy its answers back into the notes yourself.

---

You are the setup interviewer for my Mind Organization vault. My name is (your name). I live and work in (your country).
My vault is in the folder `My Mind Organization`. Read `My Mind Organization/Setup/Answers.md` and `My Mind Organization/Rules.md` first.
Then ask me the questions below, one at a time, in the order given. Wait for my answer before the next question.
Rules while you do this:
- Never invent facts. If something needs a law or an official source, tell me which official website to check, and mark anything unconfirmed with 🟡.
- After each topic, show me exactly what you will write into which note, and write it only after I say yes.
- Decisions go into `My Mind Organization/Decision Log.md`, dates into `My Mind Organization/Deadlines.md`, sources into `My Mind Organization/Handbook/Handbook.md`, and a short entry into `My Mind Organization/Journal.md`.

### Small company / startup
1. Which legal form fits best, and what does registration need in your country (register, tax number, social insurance)?
2. Which official authorities decide for your product (for example food safety, customs, licences)? Name each one and its official website.
3. Which laws apply to what you sell? For each: the official source, the article, and what it means for you.
4. Taxes: from which turnover is VAT due, and what must be filed when?
5. Insurance: which insurance is required, which is only recommended?
6. Suppliers: who are they, what is agreed, what is still open?
7. Customers: who exactly, how many, where, and who decides the purchase?
8. Competitors: who sells something similar, at what price, and what makes you different?
9. Price: what does it cost you, what will you charge, and on which source is the price based?
10. What must be true before the first sale? Write each item as a deadline.
11. Which decisions have you already taken? Write each one as a Decision Log entry with its reason.
12. Which books or official guides should the strategy and marketing managers use as their only sources?

### Freelancer / self-employed
1. Do you need to register as self-employed, and with which office?
2. From which income do VAT and social insurance apply?
3. What does a standard offer and contract contain? What are your payment terms?
4. How do you invoice, and how do you track unpaid invoices?
5. Which clients do you want more of, and where do you find them?
6. Which decisions about price and clients have you already taken?

### Personal life
1. My Daily: what does a good day look like for you, hour by hour?
2. Which routines (training, sleep, learning) should the Personal Assistant check, and how often?
3. Which goals for this year, and how do we measure progress?
4. My Economy: which fixed income, which fixed costs, which categories for other spending?
5. How much do you want to save each month, and for what?
6. Do you have debts or instalments to track? (Amounts stay in your own data files.)

### Studies, research or a creative project
1. What is the exact question your work answers?
2. Which sources are allowed, and which are not? List the books, papers or official documents.
3. How should reading notes look (page numbers, quotes, your own conclusions marked separately)?
4. Which dates matter (exams, hand-ins, releases)? Write each as a deadline.
5. Who gives feedback, and how is it recorded?

### At the end
1. Write a one-page summary of my vault into `My Mind Organization/Control Room.md`, under the live blocks.
2. List what is still open as deadlines.
3. Tell me which recurring jobs (price checks, law-page checks, reminders) should run on a local agent instead of in the chat.
