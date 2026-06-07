# 🎵 Royalties — Music Analytics Platform

Aplicación web para analizar reportes de regalías musicales de DistroKid.
Stack: React + Vite + TypeScript + Supabase + Tailwind CSS.

---

## Instalación en 5 pasos

### 1. Instalar dependencias

```bash
cd royalties-app
npm install
```

### 2. Configurar Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un proyecto nuevo.
2. En el dashboard, ve a **SQL Editor** y ejecuta todo el contenido de `supabase/schema.sql`.
3. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public` key

### 3. Crear archivo .env

Crea un archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### 4. Crear tu primer usuario admin

1. En Supabase dashboard, ve a **Authentication → Users → Add user**.
2. Crea un usuario con tu email y contraseña.
3. En **SQL Editor**, ejecuta:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'tu@email.com';
```

### 5. Levantar el servidor

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173).

---

## Estructura del proyecto

```
royalties-app/
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx      # Auth + inactividad
│   ├── lib/
│   │   ├── supabase.ts          # Cliente Supabase
│   │   ├── utils.ts             # Formatters
│   │   └── distrokid-parser.ts  # Parser CSV/Excel
│   ├── pages/
│   │   ├── LoginPage.tsx        # Login + recuperar contraseña
│   │   ├── ResetPasswordPage.tsx
│   │   ├── DashboardPage.tsx    # Dashboard con gráficas
│   │   ├── UploadPage.tsx       # Subir reporte
│   │   ├── ReportsPage.tsx      # Listado de reportes
│   │   ├── ReportDetailPage.tsx # Análisis detallado
│   │   └── AdminPage.tsx        # Panel admin
│   ├── types/
│   │   └── database.ts          # Tipos TypeScript
│   ├── App.tsx                  # Rutas
│   └── main.tsx
├── supabase/
│   └── schema.sql               # Tablas + RLS + Storage
└── .env.example
```

---

## Características

- ✅ Login con email/contraseña
- ✅ Recuperación de contraseña
- ✅ Cierre automático por inactividad (30 min)
- ✅ Roles Admin / Usuario
- ✅ Panel admin: crear, editar, activar/desactivar y eliminar usuarios
- ✅ Subir reportes CSV/Excel de DistroKid
- ✅ Parseo automático de columnas de DistroKid
- ✅ Dashboard con gráficas (área, barras, pie, línea)
- ✅ Análisis: ingresos por plataforma, país, canción, mes
- ✅ Filtros por plataforma y canción
- ✅ Exportar a Excel y PDF
- ✅ RLS habilitado en todas las tablas
- ✅ Storage con acceso por usuario
- ✅ Modo oscuro + diseño SaaS premium

---

## Deploy en Vercel / Netlify

```bash
npm run build
```

Sube la carpeta `dist/` o conecta el repo directamente.
Recuerda agregar las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

---

## Nota sobre creación de usuarios

La creación de usuarios desde el panel Admin usa `supabase.auth.admin.createUser()`,
que requiere la **service role key**. Para producción, implementa un Edge Function
de Supabase que reciba los datos y cree el usuario de forma segura sin exponer la service key en el frontend.
