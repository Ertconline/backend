# Дев лог перенос монги на репликацию

ставим монгу на сервак арбитра

версии монги должны совпадать на всех трех серверах

``ssh ubuntu@18.188.107.133``

```
wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.4 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.4.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```
открываем порт 27017

делаем алиасы доменов для айпишников

``sudo nano /etc/hosts``
```
18.188.107.133 arb
18.216.202.58 db2
45.67.57.133 db1
```
генерируем ключ авторизации для реплики

``openssl rand -base64 756 > ertcreplicakey``

раскидываем его по серверам
```
scp ertcreplicakey ubuntu@18.188.107.133:/home/ubuntu/ertcreplicakey
scp ertcreplicakey ubuntu@18.216.202.58:/home/ubuntu/ertcreplicakey
scp ertcreplicakey ertc-prod:/root/ertcreplicakey
```
меняем права и хозяина
```
ssh ubuntu@18.188.107.133 "chmod 400 /home/ubuntu/ertcreplicakey;sudo chown mongodb:mongodb /home/ubuntu/ertcreplicakey"

ssh ubuntu@18.216.202.58 "chmod 400 /home/ubuntu/ertcreplicakey;sudo chown mongodb:mongodb /home/ubuntu/ertcreplicakey"

ssh ertc-prod "chmod 400 /root/ertcreplicakey;sudo chown mongodb:mongodb /root/ertcreplicakey"
```
добавляем админа
```
use admin
db.createUser(
  {
    user: "r00t",
    pwd: "123",
    roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
  }
)
```
выдаем права
```
db.grantRolesToUser(
   "r00t",
   [ "clusterManager" ]
)
```
добавляем пользователя для базы
```
use ertc
db.createUser(
    {
      user: "ertc",
      pwd: "123",
      roles: [
         { role: "readWrite", db: "ertc" }
      ]
    }
);
```
меняем конфиг на всех серверах

``sudo nano /etc/mongod.conf``

добавляем реплику
```
replication:
  replSetName: rs0
```
меняем бинд
```
net:
  port: 27017
  bindIp: 0.0.0.0
```
обновляем исходники и конфиги
```
git remote remove origin
git remote add origin https://gitlab+deploy-token-6:as8egQxXz_xsJH1RxhxT@gitlab.i-link.pro/ertc/backend.git
git branch --set-upstream-to=origin/master master
git pull
```
останавливаем апи

``pm2 stop all``

делаем бэкап текущей базы
```
mongodump -d ertc --gzip -o /root/backup/`date +%d-%m-%y`m
zip /root/backup/`date +%d-%m-%y`-mio-db.zip /root/backup/`date +%d-%m-%y`m -r
rm -rf /root/backup/`date +%d-%m-%y`m
```

перезапускаем монгу и сразу статус проверяем

``sudo systemctl restart mongod``

``sudo systemctl status mongod``

если чет не так смотрим логи монги

``less /var/log/mongodb/mongod.log``

заходим в консоль монги на первом серваке

``mongo``

``rs.initiate()``

если хост не совпадает с db1, переписываем
```
cfg = rs.conf()
cfg.members[0].host = "db1:27017"
rs.reconfig(cfg)
```

добавляем остальных
```
rs.add("db2")
rs.addArb("arb:27017")
```
смотрим что получилось
```
rs.conf()
rs.status()
```
ждем пока засинкается вторая бдшка

меняем конфиг на всех серверах

``sudo nano /etc/mongod.conf``

добавляем авторизацию
```
security:
  keyFile: /home/ubuntu/ertcreplicakey
  authorization: enabled
```
перезапускаем монгу и сразу статус проверяем
```
sudo systemctl restart mongod
sudo systemctl status mongod
```
заходим в консоль монги на первом серваке

``mongo -u r00t -p -authenticationDatabase admin``

на втором

``mongo -u ertc -p -authenticationDatabase ertc``

запускаем апишки
