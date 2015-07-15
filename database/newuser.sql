-- Add a user named 'flmtest' and grant privs to the 'flm' database
CREATE DATABASE flm IF NOT EXISTS;
CREATE USER 'flmtest'@'localhost' IDENTIFIED BY 'pwd';
GRANT CREATE, DROP, ALTER, INSERT, UPDATE, SELECT, DELETE, INDEX ON flm.* TO 'flmtest'@'localhost';
FLUSH PRIVILEGES;
