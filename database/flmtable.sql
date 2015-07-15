-- Create 'flm' table with a simple schema for storing FLM XML documents
USE flm;
CREATE TABLE flm (
       facility_id VARCHAR(255) NOT NULL,
       modified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       xml_data LONGTEXT NOT NULL,

       PRIMARY KEY (facility_id)
);
