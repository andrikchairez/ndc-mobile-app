const mysql = require('mysql');
const dotenv = require('dotenv');

// Loads environment variables from .env file
dotenv.config();

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

//Translates National Drug Codes (NDCs) into RXCUI codes using a MySQL stored procedure
const translateNDCToRXCUI = (ndc) => {
  return new Promise((resolve, reject) => {
    pool.query('CALL sp_GetRxcuiFromNdc(?)', [ndc], (error, results) => {
      if (error) {
        console.error('Error executing stored procedure:', error);
        return reject('Error translating NDC to RXCUI');
      }

      //Creates an object for successful, or failed reads of the MySQL stored procedure
      if (results[0] && results[0][0]) {
        const { RXCUI: rxcui, STR: drugName } = results[0][0];
        resolve({ ndc, rxcui, drugName });
      } else {
        resolve({ ndc, rxcui: null, drugName: null });
      }
    });
  });
};

module.exports = { translateNDCToRXCUI };