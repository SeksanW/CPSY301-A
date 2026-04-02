-- ARIS LIMS Database Schema

CREATE DATABASE IF NOT EXISTS aris_lims;
USE aris_lims;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- COC documents table
CREATE TABLE IF NOT EXISTS coc_doc (
  coc_id VARCHAR(50) PRIMARY KEY,
  project_name VARCHAR(200),
  report_name VARCHAR(200),
  report_email VARCHAR(200),
  alternative_email VARCHAR(200),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  submitted_by VARCHAR(150),
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  file_path VARCHAR(500)
);

-- Samples table
CREATE TABLE IF NOT EXISTS samples (
  sample_id VARCHAR(50) PRIMARY KEY,
  coc_id VARCHAR(50) NOT NULL,
  sample_type VARCHAR(100),
  description TEXT,
  date_time_completed DATETIME,
  sample_point VARCHAR(200),
  time_collected TIME,
  matrix VARCHAR(100),
  FOREIGN KEY (coc_id) REFERENCES coc_doc(coc_id) ON DELETE CASCADE
);

-- ICP results
CREATE TABLE IF NOT EXISTS icp (
  icp_id INT AUTO_INCREMENT PRIMARY KEY,
  sample_id VARCHAR(50) NOT NULL,
  ll_tm FLOAT,
  ll_dm FLOAT,
  ba_tm FLOAT,
  ba_dm FLOAT,
  mg_tm FLOAT,
  FOREIGN KEY (sample_id) REFERENCES samples(sample_id) ON DELETE CASCADE
);

-- Alkalinity results
CREATE TABLE IF NOT EXISTS alkalinity (
  alkalinity_id INT AUTO_INCREMENT PRIMARY KEY,
  sample_id VARCHAR(50) NOT NULL,
  p_alk_ppm FLOAT,
  t_alk_ppm FLOAT,
  hydroxide_ppm FLOAT,
  carbonate_ppm FLOAT,
  bicarb_ppm FLOAT,
  FOREIGN KEY (sample_id) REFERENCES samples(sample_id) ON DELETE CASCADE
);

-- pH / Conductivity results
CREATE TABLE IF NOT EXISTS ph_conductivity (
  ph_cond_id INT AUTO_INCREMENT PRIMARY KEY,
  sample_id VARCHAR(50) NOT NULL,
  ph FLOAT,
  temperature FLOAT,
  conductivity FLOAT,
  FOREIGN KEY (sample_id) REFERENCES samples(sample_id) ON DELETE CASCADE
);

-- TIC/TOC results
CREATE TABLE IF NOT EXISTS tictoc (
  tictoc_id INT AUTO_INCREMENT PRIMARY KEY,
  sample_id VARCHAR(50) NOT NULL,
  tic_final_result FLOAT,
  tic_as_caco3 FLOAT,
  toc_final_result FLOAT,
  toc_as_caco3 FLOAT,
  FOREIGN KEY (sample_id) REFERENCES samples(sample_id) ON DELETE CASCADE
);

-- IC results
CREATE TABLE IF NOT EXISTS ic (
  ic_id INT AUTO_INCREMENT PRIMARY KEY,
  sample_id VARCHAR(50) NOT NULL,
  f_ppm FLOAT,
  cl_ppm FLOAT,
  no2_ppm FLOAT,
  br_ppm FLOAT,
  no3_ppm FLOAT,
  FOREIGN KEY (sample_id) REFERENCES samples(sample_id) ON DELETE CASCADE
);

-- Seed admin user (password: admin123)
INSERT IGNORE INTO users (username, name, email, password_hash, role)
VALUES ('admin', 'Administrator', 'admin@aris.sait.ca',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
