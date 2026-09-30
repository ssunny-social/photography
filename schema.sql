CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  artist TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  statement TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  object_key TEXT,
  sample_seed INTEGER,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Personal',
  location TEXT NOT NULL DEFAULT '',
  year TEXT NOT NULL DEFAULT '',
  story TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO profile (id, artist, title, subtitle, statement, location)
VALUES (1, 'Suraj Sunny', 'Light, Held Still', 'A personal digital exhibition',
'An evolving collection of quiet observations — places, people, and the small moments between them.',
'Online · 2026');

INSERT OR IGNORE INTO photos (id, sample_seed, title, category, location, year, story, featured, sort_order) VALUES
('sample-1',1,'After the Rain','Street','Lisbon','2025','A city briefly made new by rain and late afternoon light.',1,10),
('sample-2',2,'Blue Hour','Landscape','Pacific Coast','2025','The last quiet color before the horizon disappears.',0,20),
('sample-3',3,'Passing Through','People','Tokyo','2024','A moment of stillness inside the movement of the city.',0,30),
('sample-4',4,'Soft Geometry','Architecture','Copenhagen','2025','Concrete, shadow, and the warmth of a single open window.',1,40),
('sample-5',5,'Summer Table','Still Life','Home','2024','What remained after everyone had gone outside.',0,50),
('sample-6',6,'Long Way Home','Landscape','Iceland','2025','A road with no promise except the next bend.',0,60),
('sample-7',7,'Sunday, 7:12','Street','Paris','2024','The rare hour when the city belongs to no one.',0,70),
('sample-8',8,'In Bloom','Nature','Kyoto','2025','A season measured in petals and passing weather.',1,80);
