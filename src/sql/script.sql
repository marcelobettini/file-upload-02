-- API educativa de expedientes judiciales (MySQL 8.0+)
-- Ejecutar el script completo. No borra tablas ni datos existentes.

CREATE DATABASE IF NOT EXISTS expedientes_demo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE expedientes_demo;

-- 1. Clientes
CREATE TABLE IF NOT EXISTS clients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  document_number VARCHAR(20) NOT NULL,
  email VARCHAR(150) NULL,
  phone VARCHAR(30) NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_clients_document_number UNIQUE (document_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Expedientes
CREATE TABLE IF NOT EXISTS cases (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_number VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  client_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_cases_case_number UNIQUE (case_number),
  INDEX idx_cases_client_id (client_id),
  CONSTRAINT fk_cases_client
    FOREIGN KEY (client_id) REFERENCES clients(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Documentos: metadatos; el contenido vive en uploads/
CREATE TABLE IF NOT EXISTS documents (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id INT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size BIGINT UNSIGNED NOT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_documents_stored_name UNIQUE (stored_name),
  INDEX idx_documents_case_id (case_id),
  CONSTRAINT fk_documents_case
    FOREIGN KEY (case_id) REFERENCES cases(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Validación rápida de las tablas creadas:
SHOW TABLES;