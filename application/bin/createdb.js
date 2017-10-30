const mysql = require('mysql');

const env = process.env.NODE_ENV || "development";
const config = require(__dirname + '/../config/config.js')[env];

if(env == "production"){
    config.password = config.password || process.env.MYSQL_ROOT_PASSWORD
}

let con = mysql.createConnection({
  host: config.host,
  user: config.username,
  password: config.password
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
  con.query("CREATE DATABASE IF NOT EXISTS " + config.database, function (err, result) {
    if (err) throw err;
    console.log("Database created");
    process.exit(0);
  });
});
