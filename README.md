# 🚀 Acadèmia Impulsa't — App de gestió interna

App web senzilla per gestionar alumnes, professors, horaris, pagaments, finances i tasques.

---

## 📁 Estructura de fitxers

```
academia-impulsat/
├── index.html          → Estructura HTML de l'app
├── styles.css          → Diseny i estils
├── app.js              → Tota la lògica JavaScript
├── supabase-config.js  → Les teves credencials de Supabase (edita aquí)
└── README.md           → Aquesta guia
```

---

## ⚙️ Configuració pas a pas

### 1. Crea el projecte a Supabase

1. Ves a [https://supabase.com](https://supabase.com) i crea un compte gratuït.
2. Crea un nou projecte (tria una contrasenya segura per a la BD).
3. Espera uns minuts mentre es configura.

### 2. Crea les taules a Supabase

1. Ves a **SQL Editor** al menú lateral.
2. Copia tot el codi SQL de la secció de més a baix.
3. Enganxa'l i fes clic a **Run**.

### 3. Configura les credencials

1. Ves a **Settings → API** al teu projecte de Supabase.
2. Copia el **Project URL** i la **anon public key**.
3. Obre el fitxer `supabase-config.js` i enganxa els valors:

```js
const SUPABASE_URL  = "https://xxxxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

### 4. Obre l'app

Obre el fitxer `index.html` directament al navegador, o puja els fitxers a qualsevol servidor web (Netlify, Vercel, GitHub Pages, etc.).

---

## ⚠️ Seguretat important

> **Aquesta app NO té login.**
> Qualsevol persona amb la URL pot accedir i gestionar totes les dades.
>
> ✅ Recomanació: **no comparteixes la URL públicament**.
> ✅ Per a ús intern (ordinador de l'acadèmia), és perfectament vàlid.
> ✅ En el futur, si ho vols protegir, pots afegir autenticació a Supabase.

La `anon key` de Supabase és segura per a ús en frontends, però les dades queden exposades si l'URL és accessible. Per a dades sensibles, activa les **Row Level Security (RLS)** policies a Supabase.

---

## 🗄️ SQL — Crea les taules a Supabase

Copia i executa tot el següent codi al **SQL Editor** de Supabase:

```sql
-- ============================================================
--  Acadèmia Impulsa't — Esquema de base de dades
-- ============================================================

-- STUDENTS
create table if not exists students (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  surname       text not null,
  course        text,
  subjects      text,
  phone         text,
  email         text,
  status        text not null default 'actiu' check (status in ('actiu','pausat','baixa')),
  monthly_price numeric(8,2) default 0,
  renewal_day   integer check (renewal_day between 1 and 31),
  notes         text,
  created_at    timestamptz default now()
);

create index if not exists idx_students_status on students(status);
create index if not exists idx_students_name   on students(name);

-- TEACHERS
create table if not exists teachers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  surname      text not null,
  phone        text,
  email        text,
  subjects     text,
  availability text,
  status       text not null default 'actiu' check (status in ('actiu','inactiu')),
  notes        text,
  created_at   timestamptz default now()
);

create index if not exists idx_teachers_status on teachers(status);

-- CLASSES
create table if not exists classes (
  id             uuid primary key default gen_random_uuid(),
  day_order      integer not null check (day_order between 1 and 7),
  start_time     time not null,
  end_time       time not null,
  subject        text,
  teacher_id     uuid references teachers(id) on delete set null,
  students_label text,
  student_ids    text[],
  room           text,
  notes          text,
  created_at     timestamptz default now()
);

create index if not exists idx_classes_day     on classes(day_order);
create index if not exists idx_classes_teacher on classes(teacher_id);

-- PAYMENTS
create table if not exists payments (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid references students(id) on delete cascade,
  payment_month  text not null,
  amount         numeric(8,2) not null default 0,
  due_date       date,
  paid_date      date,
  status         text not null default 'pendent' check (status in ('pendent','pagat','vençut')),
  payment_method text,
  notes          text,
  created_at     timestamptz default now()
);

create index if not exists idx_payments_student on payments(student_id);
create index if not exists idx_payments_status  on payments(status);
create index if not exists idx_payments_month   on payments(payment_month);
create index if not exists idx_payments_due     on payments(due_date);

-- EXPENSES
create table if not exists expenses (
  id             uuid primary key default gen_random_uuid(),
  concept        text not null,
  category       text default 'Altres',
  amount         numeric(8,2) not null default 0,
  date           date not null,
  payment_method text,
  notes          text,
  created_at     timestamptz default now()
);

create index if not exists idx_expenses_date     on expenses(date);
create index if not exists idx_expenses_category on expenses(category);

-- TASKS
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  date        date,
  priority    text not null default 'mitja' check (priority in ('baixa','mitja','alta')),
  status      text not null default 'pendent' check (status in ('pendent','completada')),
  category    text,
  created_at  timestamptz default now()
);

create index if not exists idx_tasks_status   on tasks(status);
create index if not exists idx_tasks_priority on tasks(priority);
create index if not exists idx_tasks_date     on tasks(date);
```

---

## 🛡️ Row Level Security (opcional però recomanat)

Si vols una capa extra de seguretat per evitar accés no autoritzat via API, activa RLS i crea polítiques permissives (perquè no tens login):

```sql
-- Activa RLS a totes les taules
alter table students  enable row level security;
alter table teachers  enable row level security;
alter table classes   enable row level security;
alter table payments  enable row level security;
alter table expenses  enable row level security;
alter table tasks     enable row level security;

-- Permet tot a la anon key (sense login)
-- Canvia-ho si afegiu autenticació en el futur
create policy "allow_all_students"  on students  for all using (true) with check (true);
create policy "allow_all_teachers"  on teachers  for all using (true) with check (true);
create policy "allow_all_classes"   on classes   for all using (true) with check (true);
create policy "allow_all_payments"  on payments  for all using (true) with check (true);
create policy "allow_all_expenses"  on expenses  for all using (true) with check (true);
create policy "allow_all_tasks"     on tasks     for all using (true) with check (true);
```

---

## 🚀 Com publicar-la (opcional)

### Opció A — Netlify (gratuït, molt fàcil)
1. Crea compte a [netlify.com](https://netlify.com).
2. Arrossega la carpeta del projecte a la consola de Netlify.
3. Netlify et dona una URL pública. Desa-la en un lloc segur.

### Opció B — Obrir localment
Simplement obre `index.html` des del navegador. Funciona perfectament per a ús a l'ordinador de l'acadèmia.

---

## 💡 Preguntes freqüents

**Puc afegir fotos d'alumnes?**
Sí, Supabase té Storage per a fitxers. Requeriria modificar el codi.

**Puc exportar dades a Excel?**
Pots descarregar les dades des del tauler de Supabase. En el futur es pot afegir exportació CSV.

**I si tinc errors?**
Comprova la consola del navegador (F12 → Console) per veure el missatge d'error exact.

---

Fet amb ❤️ per a l'Acadèmia Impulsa't.

---

## 📱 PWA — Com instal·lar-la al mòbil o escriptori

Un cop desplegada a Vercel, l'app es pot instal·lar com si fos una app nativa:

### 📱 Mòbil (iOS — Safari)
1. Obre la URL de Vercel amb Safari.
2. Toca el botó **Compartir** (📤).
3. Selecciona **"Afegir a la pantalla d'inici"**.
4. Posa el nom i confirma.

### 📱 Mòbil (Android — Chrome)
1. Obre la URL amb Chrome.
2. El navegador mostrarà un banner "Instal·lar app" automàticament.
3. O bé: menú (⋮) → **"Afegir a la pantalla d'inici"**.

### 💻 Escriptori (Chrome / Edge)
1. Obre la URL.
2. A la barra d'adreça apareixerà una icona d'instal·lació (⊕).
3. Fes clic i confirma la instal·lació.

---

## 🚀 Deploy a Vercel (pas a pas)

### Opció A — Sense Git (més ràpida)
1. Ves a [vercel.com](https://vercel.com) i crea un compte gratuït.
2. Des del dashboard, fes clic a **"Add New → Project"**.
3. Selecciona **"Deploy from CLI"** o arrossega la carpeta del projecte.
4. Vercel et donarà una URL tipus `academia-impulsat.vercel.app`.

### Opció B — Amb GitHub (recomanada per actualitzar fàcilment)
1. Puja la carpeta a GitHub (repositori privat).
2. Connecta el repositori a Vercel.
3. Cada vegada que facis canvis i els pugis a GitHub, Vercel es desplegarà automàticament.

### Variables d'entorn a Vercel
Com que `supabase-config.js` conté les teves credencials directament, **no cal configurar variables d'entorn a Vercel**. Simplement puja el fitxer amb les teves claus ja escrites.

> ⚠️ Si el teu repositori és públic a GitHub, **no pugis** `supabase-config.js` amb les claves reals. En aquest cas, usa `.gitignore` per excloure'l i configura'l manualment a Vercel com a fitxer estàtic.

