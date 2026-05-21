Prisma migrations are generated from `prisma/schema.prisma`.

For a new environment:

```bash
npm install
npx prisma migrate dev --name init
```

For production deployment:

```bash
npx prisma migrate deploy
```

This repository includes the schema and migration scripts in `package.json`; generate the initial SQL migration after dependencies are installed so Prisma can use the exact local engine version.
