import csv

# Sample staff data
staff_data = [
    ['name', 'department', 'employee_id'],  # Header row
    ['John Smith', 'Front Desk', 'EMP0001'],
    ['Maria Garcia', 'Housekeeping', 'EMP0002'],
    ['David Chen', 'Maintenance', 'EMP0003'],
    ['Sarah Johnson', 'Food & Beverage', 'EMP0004'],
    ['Michael Brown', 'Security', 'EMP0005'],
    ['Lisa Wong', 'Front Desk', 'EMP0006'],
    ['James Wilson', 'Housekeeping', 'EMP0007'],
    ['Emma Davis', 'Food & Beverage', 'EMP0008'],
    ['Robert Taylor', 'Maintenance', 'EMP0009'],
    ['Sophie Lee', 'Security', 'EMP0010']
]

# Write to CSV file
with open('sample_staff.csv', 'w', newline='') as file:
    writer = csv.writer(file)
    writer.writerows(staff_data)

print("Sample staff CSV file has been created: sample_staff.csv")
print("\nYou can now use this file to import staff data using:")
print("python3 import_staff.py")
print("\nWhen prompted, enter: /Users/yinscubaspa/Desktop/Cursor_uniform_inventory/sample_staff.csv") 