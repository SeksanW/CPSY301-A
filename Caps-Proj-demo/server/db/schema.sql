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

-- ICP results total & Dissolved Metals
CREATE TABLE IF NOT EXISTS icp (
  icp_id INT AUTO_INCREMENT PRIMARY KEY,
  sample_id VARCHAR(50) NOT NULL,
  li_tm FLOAT, li_dm FLOAT,
  be_tm FLOAT, be_dm FLOAT,
  mg_tm FLOAT, mg_dm FLOAT,
  al_tm FLOAT, al_dm FLOAT,
  p_tm  FLOAT, p_dm  FLOAT,
  ca_tm FLOAT, ca_dm FLOAT,
  ti_tm FLOAT, ti_dm FLOAT,
  v_tm  FLOAT, v_dm  FLOAT,
  cr_tm FLOAT, cr_dm FLOAT,
  mn_tm FLOAT, mn_dm FLOAT,
  fe_tm FLOAT, fe_dm FLOAT,
  co_tm FLOAT, co_dm FLOAT,
  ni_tm FLOAT, ni_dm FLOAT,
  cu_tm FLOAT, cu_dm FLOAT,
  zn_tm FLOAT, zn_dm FLOAT,
  as_tm FLOAT, as_dm FLOAT,
  se_tm FLOAT, se_dm FLOAT,
  sr_tm FLOAT, sr_dm FLOAT,
  mo_tm FLOAT, mo_dm FLOAT,
  cd_tm FLOAT, cd_dm FLOAT,
  sb_tm FLOAT, sb_dm FLOAT,
  ba_tm FLOAT, ba_dm FLOAT,
  tl_tm FLOAT, tl_dm FLOAT,
  pb_tm FLOAT, pb_dm FLOAT,
  u_tm  FLOAT, u_dm  FLOAT,
  ag_tm FLOAT, ag_dm FLOAT,
  b_tm  FLOAT, b_dm  FLOAT,
  na_tm FLOAT, na_dm FLOAT,
  si_tm FLOAT, si_dm FLOAT,
  s_tm  FLOAT, s_dm  FLOAT,
  k_tm  FLOAT, k_dm  FLOAT,
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
  carb_as_co3_mgl FLOAT,
  bicarb_as_hco3_mgl FLOAT,
  hydroxide_as_oh_mgl FLOAT,
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
  tic_result_ppm FLOAT,
  tic_final_result_ppm FLOAT,
  tic_as_caco3 FLOAT,
  toc_result_ppm FLOAT,
  toc_final_result_ppm FLOAT,
  toc_as_caco3 FLOAT,
  FOREIGN KEY (sample_id) REFERENCES samples(sample_id) ON DELETE CASCADE
);

-- IC results
CREATE TABLE IF NOT EXISTS ic (
  ic_id INT AUTO_INCREMENT PRIMARY KEY,
  sample_id VARCHAR(50) NOT NULL,
  f_ppm   FLOAT,
  cl_ppm  FLOAT,
  no2_ppm FLOAT,
  br_ppm  FLOAT,
  no3_ppm FLOAT,
  so4_ppm FLOAT,
  po4_ppm FLOAT,
  FOREIGN KEY (sample_id) REFERENCES samples(sample_id) ON DELETE CASCADE
);

-- Custom test results (flexible test types)
CREATE TABLE IF NOT EXISTS custom_tests (
  custom_test_id INT AUTO_INCREMENT PRIMARY KEY,
  sample_id VARCHAR(50) NOT NULL,
  test_name VARCHAR(100) NOT NULL,
  fields JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sample_id) REFERENCES samples(sample_id) ON DELETE CASCADE
);

-- Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
  activity_id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  coc_id VARCHAR(50),
  performed_by VARCHAR(150),
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed admin user (password: admin123)
INSERT IGNORE INTO users (username, name, email, password_hash, role)
VALUES ('admin', 'Administrator', 'admin@aris.sait.ca',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
