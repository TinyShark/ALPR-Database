# Testing new features
Added websocket for live_feed so that plates entries are added to the dashboard when they are received via the API.

Added option to add plates to the Known Plates via UI.

Remove spaces from API plate numbers before storing in the DB.


### Add new API endpoint for Known Plates:

### Query Known Plate exists:
`curl -X GET "<ipaddress>:3000/api/known-plates?plate=AAA123"`

### Optionally use fuzzy matching to find plates with similar numbers (For OCR misreads):
`curl -X GET "<ipaddress>:3000/api/known-plates?plate=AAA123&fuzzy=true"`

### Add Plate to Known Plates:
```
curl -X PUT "<ipaddress>:3000/api/known-plates" \
-H "Content-Type: application/json" \
-d '{"plateNumber": "AAA123", "name": "John'\''s Car"}'
```

### Delete Plate from Known Plates:
`curl -X DELETE "<ipaddress>:3000/api/known-plates?plate=AAA123"`

# ALPR Database
A Fully-Featured Automated License Plate Recognition Database for Blue Iris + CodeProject AI Server


![enter image description here](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/Hero.jpg)

## Overview

I've been using [CodeProject AI](https://github.com/codeproject/CodeProject.AI-Server) with [Mike Lud's](https://github.com/MikeLud) license plate model on [Blue Iris](https://blueirissoftware.com/) for a couple years now, but in this setup, the ALPR doesn't really do a whole lot. Really, you have more of a license plate camera with some AI as a bonus, and no nice way to take advantage the data other than parsing Blue Iris logs or paying $600+/year for PlateMinder or Rekor ALPR.

This project serves as a complement to a CodeProject Blue Iris setup, giving you a full-featured database to store and _actually use_ your ALPR data, **completely for free.** Complete with the following it has a very solid initial feature set and is a huge upgrade over the standard setup.

Please star and share the project :)
#### Features:

- Searchable Database
- Live recognition feed with images
- Add vehicles you know to a known plates table
- Custom tags
- Configurable retention
- Configurable Push Notifications
- Flexible API
- Detailed system insights

## Install

Docker is the easiest and fastest way to deploy. Below is a docker-compose.yml file that will create a stack with both the application and a database. Just run the compose and you will have everything you need. If you prefer to use a separate database, you can either just spin up the container on its own from the image or use the docker-compose-without-database.yml in the repository.

##### Quick Start:

1. Ensure you have Docker installed on your system.

2. In a new directory, create a file named `docker-compose.yml` and paste in the content below, changing the variables to the passwords you would like to use.

3. Create two new directories / folders in this directory called "config" and "auth". These will ensure that your settings are saved separately and not lost during updates.

4. Download the required database schema:
   `curl -O https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/schema.sql`
   Or, if you prefer a download link, click [here](https://github.com/algertc/ALPR-Database/blob/main/schema.sql) to download the schema from this repository. Place it in the same directory as your docker-compose.yml.

5. Start the application: `docker compose up -d `

6. Access the application at `http://localhost:3000`

### Docker Compose

```yaml
version: "3.8"
services:
  app:
    image: algertc/alpr-dashboard:latest
    restart: unless-stopped
    ports:
      - "3000:3000"  # Change the first port to the port you want to expose
    environment:
      - NODE_ENV=production
      - ADMIN_PASSWORD=password  # Change this to a secure password
      - DB_PASSWORD=password  # Change this to match your postgres password
    depends_on:
      - db
    volumes:
      - app-auth:/app/auth
      - app-config:/app/config

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=postgres
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password  # Change this to a secure password
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  db-data:
  app-auth:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./auth
  app-config:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./config

```

## Setup

There is currently support for both API Posts and MQTT, however, the API is significantly more reliable. Ingestion via MQTT is not recommended.

#### Get Your API Key

To start sending data, spin up the docker containers and log in to the application. **Navigate to settings -> security** in the bottom left hand corner. At the bottom of the page you should see an API key. Click the eye to reveal the key and copy it down for use on Blue Iris.

![enter image description here](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/apikey.png)

#### Set up an alert action within Blue Iris:

ALPR recognitions are sent to the `api/plate-reads` endpoint.

We can make use of the built-in macros to dynamically get the alert data and send it as our payload. It should look like this:

    { "plate_number":"&PLATE", "Image":"&ALERT_JPEG", "timestamp":"&ALERT_TIME" }

**Set your API key with the x-api-key header as seen below.**
![enter image description here](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/blueiris.png)

Note: The &PLATE macro will only send one plate number per alert. If you need to detect multiple plates in a single alert/image, you can optionally use the memo instead of the plate number. Your payload should look like this:

    { "memo":"&MEMO", "Image":"&ALERT_JPEG", "timestamp":"&ALERT_TIME" }


#### Thats it! You're now collecting and storing your ALPR data.

## Future Considerations

- Better image storage instead of giant base64 in database.
- Ability to share your plate database with others

## Screenshots

![enter image description here](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/4.png)
![enter image description here](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/3.png)
![enter image description here](https://github.com/algertc/ALPR-Database/blob/main/Images/2.png?raw=true)
![enter image description here](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/1.png)
![enter image description here](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/5.png)

## Disclaimer

This is meant to be a helpful project. It is not an official release. It is not secure and should not be exposed outside your network.
