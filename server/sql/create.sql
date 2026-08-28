CREATE DATABASE IF NOT EXISTS `curva_denim_b2b` CHARACTER SET utf8mb4;

CREATE USER IF NOT EXISTS 'curva_app'@'%' IDENTIFIED BY 'curva_H3o12Cre';
ALTER USER 'curva_app'@'%' IDENTIFIED BY 'curva_H3o12Cre';
GRANT ALL PRIVILEGES ON curva_denim_b2b.* TO 'curva_app'@'%';
FLUSH PRIVILEGES;

USE `curva_denim_b2b`;
