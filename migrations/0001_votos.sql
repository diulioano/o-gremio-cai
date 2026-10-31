-- Votação "quem você acha que cai?". Ver specs/003-votacao-rebaixados/data-model.md.
-- O Worker valida tudo antes de gravar; os CHECK são uma segunda barreira, caso algo escape.

-- um voto por aparelho/navegador; voter é um UUID aleatório gerado no navegador (nada de IP, nome ou e-mail)
CREATE TABLE votes (
  voter TEXT PRIMARY KEY CHECK (length(voter) = 36),
  t1    INTEGER NOT NULL CHECK (t1 > 0),
  t2    INTEGER NOT NULL CHECK (t2 > 0),
  t3    INTEGER NOT NULL CHECK (t3 > 0),
  at    INTEGER NOT NULL,
  CHECK (t1 <> t2 AND t1 <> t3 AND t2 <> t3)
) WITHOUT ROWID;

-- contagem pronta, para a página ler ~10 linhas em vez de todos os votos.
-- team_id é o id da football-data; team_id = 0 guarda o total de votantes
CREATE TABLE tally (
  team_id INTEGER PRIMARY KEY,
  n       INTEGER NOT NULL DEFAULT 0
);

-- votos por dia (UTC, 'YYYY-MM-DD'), para o teto diário
CREATE TABLE daily (
  day TEXT PRIMARY KEY,
  n   INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;

-- roda na mesma transação do INSERT: se o voto não entra (repetido), nada é contado
CREATE TRIGGER count_vote AFTER INSERT ON votes BEGIN
  INSERT INTO tally (team_id, n) VALUES (0, 1), (NEW.t1, 1), (NEW.t2, 1), (NEW.t3, 1)
    ON CONFLICT (team_id) DO UPDATE SET n = n + 1;
  INSERT INTO daily (day, n) VALUES (strftime('%Y-%m-%d', NEW.at / 1000, 'unixepoch'), 1)
    ON CONFLICT (day) DO UPDATE SET n = n + 1;
END;
