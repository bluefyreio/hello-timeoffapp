module.exports = {
  "development": {
    "dialect": "sqlite",
    "storage": "./db.development.sqlite"
  },
  "test": {
    "username": process.env.CI_DB_USERNAME,
    "password": process.env.CI_DB_PASSWORD,
    "database": process.env.CI_DB_NAME,
    "host": '127.0.0.1',
    "dialect": 'mysql'
  },
  production: {
    "username": "root",
    "password": process.env.MYSQL_ROOT_PASSWORD,
    "database": process.env.MYSQL_DATABASE,
    "host": process.env.MYSQL_HOST,
    "dialect": "mysql"
  }
}
