-- O dono da tabela também passa pelo RLS (RN-015). Superusuário continua ignorando o RLS:
-- em produção, o servidor conecta com um papel que não é superusuário.
ALTER TABLE "contents" FORCE ROW LEVEL SECURITY;
