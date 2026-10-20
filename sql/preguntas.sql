-- Ejecutar una sola vez en MySQL Workbench
USE control;

CREATE TABLE IF NOT EXISTS preguntas (
  id_pregunta INT AUTO_INCREMENT PRIMARY KEY,
  materia_id INT NOT NULL,
  pregunta VARCHAR(300) NOT NULL,
  respuesta_correcta VARCHAR(150) NOT NULL,
  incorrecta1 VARCHAR(150) NOT NULL,
  incorrecta2 VARCHAR(150) NOT NULL,
  incorrecta3 VARCHAR(150) NOT NULL,
  explicacion VARCHAR(300) NULL,
  creada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (materia_id) REFERENCES materias(id_materia) ON DELETE CASCADE
);
