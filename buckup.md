# バックアップメモ

## バックアップのとり方

```sh
BACKUP_DIR="./backup"
mkdir -p $BACKUP_DIR

# アプリを止める
docker compose stop app worker

# appからメディアデータをダンプする
docker compose run --rm --no-deps -v "$BACKUP_DIR:/backup" app sh -c 'tar -C /data -czf /backup/diary-data.tar.gz .'

# DBからdumpする
docker compose exec -T postgres pg_dump -U diary -d diary -Fc > "$BACKUP_DIR/postgres.dump"

# envも複製しておく
cp .env "$BACKUP_DIR/"
chmod 600 "$BACKUP_DIR/.env"
```

## リストア方法

```sh
# making-diary-remotion/backup にバックアップを置いておく
BACKUP_DIR="./backup"

# DB周りを起動
docker compose up -d postgres redis voicevox

# DB復元
docker compose exec -T postgres pg_restore -U diary -d diary --clean --if-exists --no-owner --no-privileges < "$BACKUP_DIR/postgres.dump"

# メディアデータの復元
docker compose run --rm --no-deps -v "$BACKUP_DIR:/backup:ro" app sh -c 'tar -C /data -xzf /backup/diary-data.tar.gz'

# アプリを起動して、リストアに問題がないかチェック
docker compose up -d
```
