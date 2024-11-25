# Automate Plugin Factory

This script automates the migration of a Backstage plugin to use the new frontend plugin API.

## Prerequisites

- Ensure you have Node.js installed on your system.
- Ensure you have Yarn installed on your system.

## Setup

1. Clone this repository.
2. Place the repository you want to migrate as a sibling to this repository. The folder structure should look like this:
   ```
   /path/to/parent-directory
   ├── automate-plugin-factory
   └── your-repo-to-migrate
   ```

## Running the Script

To run the script, use the following command:

```sh
yarn start /absolute/path/to/your-repo-to-migrate
```

Replace /absolute/path/to/your-repo-to-migrate with the absolute path to the repository you want to migrate.

This command will execute the migration script and update the specified repository.
