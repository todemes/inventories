import csv
import sqlite3
from datetime import datetime
import os

def import_staff_from_file(file_path):
    # Connect to the database
    conn = sqlite3.connect('uniform_inventory.db')
    cursor = conn.cursor()
    
    # Counter for successful imports
    imported = 0
    skipped = 0
    
    # Read the CSV file
    with open(file_path, 'r') as file:
        csv_reader = csv.DictReader(file)
        
        # Iterate through each row in the file
        for index, row in enumerate(csv_reader):
            try:
                # Generate a unique employee ID if not provided
                employee_id = row.get('employee_id', f'EMP{index+1:04d}')
                
                # Insert the staff member
                cursor.execute('''
                    INSERT INTO staff (name, department, employee_id)
                    VALUES (?, ?, ?)
                ''', (row['name'], row['department'], employee_id))
                
                imported += 1
                
            except sqlite3.IntegrityError:
                # Skip if employee_id already exists
                skipped += 1
                continue
            except Exception as e:
                print(f"Error importing row {index + 1}: {str(e)}")
                skipped += 1
                continue
    
    # Commit the changes
    conn.commit()
    conn.close()
    
    return imported, skipped

if __name__ == "__main__":
    # Get the file path from user input
    file_path = input("Enter the path to your staff file (CSV): ")
    
    try:
        imported, skipped = import_staff_from_file(file_path)
        print(f"\nImport completed successfully!")
        print(f"Imported: {imported} staff members")
        print(f"Skipped: {skipped} staff members (duplicates or errors)")
    except Exception as e:
        print(f"Error: {str(e)}") 