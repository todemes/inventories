import sqlite3

staff_list = [
    ("Romesh", "BARTENDER"),
    ("Shahadat", "BARTENDER"),
    ("Alibe", "CAPTAIN"),
    ("Anton", "CHEF"),
    ("Hashan", "CHEF"),
    ("Pintu", "CHEF"),
    ("Sudesh", "CHEF"),
    ("Branden", "CRUISE DIRECTOR"),
    ("Max", "CRUISE DIRECTOR"),
    ("Jamil", "DECK CREW"),
    ("Kuday", "DECK CREW"),
    ("Shifau", "DECK CREW"),
    ("Koky", "DHONI CAPTAIN"),
    ("Bruno", "DHONI CREW"),
    ("Hasan", "DHONI CREW"),
    ("Ana", "DIVE"),
    ("Lukas", "DIVE"),
    ("Sharif", "DIVE"),
    ("Victoria", "DIVE"),
    ("Liya", "ENGINEER"),
    ("Nihal", "ENGINEER"),
    ("Uddika", "ENGINEER"),
    ("Hamty", "FREELANCE"),
    ("Jambe", "FREELANCE"),
    ("Shaadh", "FREELANCE"),
    ("Hussain", "HOUSEKEEPING"),
    ("Nabil", "HOUSEKEEPING"),
    ("Nazmul", "HOUSEKEEPING"),
    ("Ela", "SPA THERAPIST"),
    ("Jen", "SPA THERAPIST"),
    ("Lins", "SPA THERAPIST"),
    ("Jim", "WAITER"),
    ("Abey", "BARTENDER"),
    ("Sajiv", "BARTENDER"),
    ("Mufeed", "CAPTAIN"),
    ("Abdulla", "CHEF"),
    ("Danuka", "CHEF"),
    ("Keerthi", "CHEF"),
    ("Shobuj", "CHEF"),
    ("Thomas", "CRUISE DIRECTOR"),
    ("Abo", "DECK CREW"),
    ("Helal", "DECK CREW"),
    ("Sajib", "DECK CREW"),
    ("Ablo", "DHONI CAPTAIN"),
    ("Kawsar", "DHONI CREW"),
    ("Pavel", "DHONI CREW"),
    ("Dhalhey", "DIVE"),
    ("Faiz", "DIVE"),
    ("Maty", "DIVE"),
    ("Nando", "DIVE"),
    ("Dinuka", "ENGINEER"),
    ("Mohamed", "ENGINEER"),
    ("Evan", "FREELANCE"),
    ("Sand", "FREELANCE"),
    ("Zac", "FREELANCE"),
    ("Arman", "HOUSEKEEPING"),
    ("Ruman", "HOUSEKEEPING"),
    ("Abhilash", "SPA THERAPIST"),
    ("Ayu", "SPA THERAPIST"),
    ("Mahi", "WAITER"),
    ("Tutik", "WAITER")
]

def add_staff_to_db(staff_list):
    conn = sqlite3.connect('uniform_inventory.db')
    cursor = conn.cursor()
    cursor.executemany('INSERT INTO staff (name, department) VALUES (?, ?)', staff_list)
    conn.commit()
    conn.close()

if __name__ == "__main__":
    add_staff_to_db(staff_list)
    print("Staff members added successfully.") 