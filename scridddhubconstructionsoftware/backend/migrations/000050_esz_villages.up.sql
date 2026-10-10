-- Eco-sensitive zone (ESZ) notifications and the villages each one lists, typed from the gazette
-- notification itself (services/duediligencereport/README.md, "Eco-sensitive zone check").
-- Matching a parcel is by district + taluka + village, never by village name alone: Matheran's
-- list has "Dhamani" (Panvel) while Karjat has a different village "Dhamni".
CREATE TABLE esz_notifications (
    id          text PRIMARY KEY,           -- e.g. 'matheran'
    name        text NOT NULL,              -- 'Matheran Eco-sensitive Zone'
    so_number   text NOT NULL,              -- 'S.O. 133(E)'
    notified_on date NOT NULL,
    status      text NOT NULL CHECK (status IN ('final', 'draft')),
    source_url  text NOT NULL,
    summary     text NOT NULL               -- what it restricts, in one or two lines
);

CREATE TABLE esz_villages (
    notification_id text NOT NULL REFERENCES esz_notifications(id) ON DELETE CASCADE,
    district        text NOT NULL,
    taluka          text NOT NULL,          -- as named in the notification
    village         text NOT NULL,          -- as spelled in the notification
    coverage        text NOT NULL CHECK (coverage IN ('full', 'partial')),
    PRIMARY KEY (notification_id, district, taluka, village)
);

INSERT INTO esz_notifications VALUES (
    'matheran', 'Matheran Eco-sensitive Zone', 'S.O. 133(E)', '2003-02-04', 'final',
    'https://moef.gov.in/uploads/2021/08/Notification-S.O.-133-E-on-Matheran-Eco-Sensitive-Area.pdf',
    'Outside Matheran town: buildings at most 9 m (ground + 1); no change from green, agricultural or tribal use to other uses without MoEF approval; all development needs the Monitoring Committee''s approval; no quarrying. Minimum plot 0.4 ha in green zones.'
);

INSERT INTO esz_villages (notification_id, district, taluka, village, coverage) VALUES
('matheran','Raigad','Karjat','Asai','partial'),
('matheran','Raigad','Karjat','Ashane','partial'),
('matheran','Raigad','Karjat','Bedisgaon','partial'),
('matheran','Raigad','Karjat','Bekare','partial'),
('matheran','Raigad','Karjat','Bhadwal','partial'),
('matheran','Raigad','Karjat','Bhisegaon','partial'),
('matheran','Raigad','Karjat','Bhutiwali','partial'),
('matheran','Raigad','Karjat','Damat','partial'),
('matheran','Raigad','Karjat','Halivali','partial'),
('matheran','Raigad','Karjat','Kalamboli','partial'),
('matheran','Raigad','Karjat','Kirwali','partial'),
('matheran','Raigad','Karjat','Koshane','partial'),
('matheran','Raigad','Karjat','Kushivali','partial'),
('matheran','Raigad','Karjat','Mamdapur','partial'),
('matheran','Raigad','Karjat','Mangaon Tarf Waredi','partial'),
('matheran','Raigad','Karjat','Matheran','full'),
('matheran','Raigad','Karjat','Neral','partial'),
('matheran','Raigad','Karjat','Pali Tarf Waredi','partial'),
('matheran','Raigad','Karjat','Umroli','partial'),
('matheran','Raigad','Karjat','Wanjale','partial'),
('matheran','Raigad','Khalapur','Borgaon Bk.','partial'),
('matheran','Raigad','Khalapur','Borgaon Kh.','partial'),
('matheran','Raigad','Khalapur','Chowk Maniwali','partial'),
('matheran','Raigad','Khalapur','Lodhivali','partial'),
('matheran','Raigad','Khalapur','Nadhal','partial'),
('matheran','Raigad','Khalapur','Naniwali','partial'),
('matheran','Raigad','Khalapur','Sondewadi','partial'),
('matheran','Raigad','Khalapur','Wad Vihar','partial'),
('matheran','Raigad','Khalapur','Warose Tarf Wankhal','partial'),
('matheran','Raigad','Khalapur','Wawarle','partial'),
('matheran','Raigad','Panvel','Ambhe Tarf Taloje','partial'),
('matheran','Raigad','Panvel','Ambivali','partial'),
('matheran','Raigad','Panvel','Barwai','partial'),
('matheran','Raigad','Panvel','Bherle','partial'),
('matheran','Raigad','Panvel','Bhingar','partial'),
('matheran','Raigad','Panvel','Bhokarpada','partial'),
('matheran','Raigad','Panvel','Cheravali','partial'),
('matheran','Raigad','Panvel','Chorme','partial'),
('matheran','Raigad','Panvel','Deharang','partial'),
('matheran','Raigad','Panvel','Dhamani','partial'),
('matheran','Raigad','Panvel','Dhodani','partial'),
('matheran','Raigad','Panvel','Dundre','partial'),
('matheran','Raigad','Panvel','Gadhe','partial'),
('matheran','Raigad','Panvel','Karabeli','partial'),
('matheran','Raigad','Panvel','Karambeli Tarf Taloje','partial'),
('matheran','Raigad','Panvel','Khairwadi','partial'),
('matheran','Raigad','Panvel','Kondale','partial'),
('matheran','Raigad','Panvel','Kondap','partial'),
('matheran','Raigad','Panvel','Luniwali','partial'),
('matheran','Raigad','Panvel','Machiprabal','full'),
('matheran','Raigad','Panvel','Mahoda','partial'),
('matheran','Raigad','Panvel','Maldunge','partial'),
('matheran','Raigad','Panvel','Mohope','partial'),
('matheran','Raigad','Panvel','Morbe','partial'),
('matheran','Raigad','Panvel','Nere','partial'),
('matheran','Raigad','Panvel','Nitale','partial'),
('matheran','Raigad','Panvel','Pali Bk.','partial'),
('matheran','Raigad','Panvel','Poyanje','partial'),
('matheran','Raigad','Panvel','Ritghar','partial'),
('matheran','Raigad','Panvel','Sangatoli','partial'),
('matheran','Raigad','Panvel','Shriavali','partial'),
('matheran','Raigad','Panvel','Tamsai','partial'),
('matheran','Raigad','Panvel','Usarli Bk.','partial'),
('matheran','Raigad','Panvel','Vavanje','partial'),
('matheran','Raigad','Panvel','Vihighar','partial'),
('matheran','Raigad','Panvel','Wajapur','full'),
('matheran','Raigad','Panvel','Waje','partial'),
('matheran','Raigad','Panvel','Wangani Tarf Taloje','partial'),
('matheran','Raigad','Panvel','Wangani Tarf Waje','partial'),
('matheran','Raigad','Panvel','Wardoli','partial'),
('matheran','Thane','Ulhasnagar','Ambhe','partial'),
('matheran','Thane','Ulhasnagar','Bandhanwadi','partial'),
('matheran','Thane','Ulhasnagar','Bendshil','partial'),
('matheran','Thane','Ulhasnagar','Bhoj','partial'),
('matheran','Thane','Ulhasnagar','Bohonoli','partial'),
('matheran','Thane','Ulhasnagar','Chikhaloli','partial'),
('matheran','Thane','Ulhasnagar','Chinchvali','partial'),
('matheran','Thane','Ulhasnagar','Dhavale','partial'),
('matheran','Thane','Ulhasnagar','Goregaon','partial'),
('matheran','Thane','Ulhasnagar','Jambhivali','partial'),
('matheran','Thane','Ulhasnagar','Kasgaon','partial'),
('matheran','Thane','Ulhasnagar','Katrap','partial'),
('matheran','Thane','Ulhasnagar','Kushavali','partial'),
('matheran','Thane','Ulhasnagar','Savaroli','partial'),
('matheran','Thane','Ulhasnagar','Shiravali','partial'),
('matheran','Thane','Ulhasnagar','Shirgaon','partial'),
('matheran','Thane','Ulhasnagar','Vangani','partial'),
('matheran','Thane','Ulhasnagar','Varade','partial'),
('matheran','Thane','Ulhasnagar','Wadi','partial');
