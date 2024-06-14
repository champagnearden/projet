# Virtuella API

Welcome to the Virtuella API documentation. This API is built using ExpressJS and MongoDB and serves as the backend for the Virtuella project. Below you'll find detailed information on how to interact with the various endpoints provided by the API.

## Table of Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Running the API](#running-the-api)
- [Testing the API](#testing-the-api)
  - [Hand-made Swagger](#hand-made-swagger)
  - [cURL Requests](#curl-requests)
- [Endpoints](#endpoints)
  - [GET Endpoints](#get-endpoints)
  - [POST Endpoints](#post-endpoints)
  - [DELETE Endpoints](#delete-endpoints)
  - [PUT Endpoints](#put-endpoints)
- [Contributing](#contributing)
- [License](#license)

## Introduction

Virtuella API is a RESTful service that provides various endpoints to manage users, employees, and their respective operations. This API is part of the Virtuella project and is called by [project&#39;s front](https://github.com/CBouij/Virtuella "Virtuella front repository").

## Installation

To install and run the API locally, follow these steps:

1. Clone the repository:
   ```sh
   git clone <repository_url>
   ```
2. Navigate to the project directory:
   ```sh
   cd virtuella-api
   ```
3. Install the dependencies:
   ```sh
   npm install
   ```
4. Set up the environment variables by modifing the `.env` file provided.

## Running the API

To start the API server, use the following command:

```sh
npm run start
```

The server will start on the port specified in the environment variables. By default, it runs on port 3000.

## Testing the API

To ensure the API is functioning correctly, you can use both Swagger and cURL requests for testing.

### Hand-made Swagger

Swagger provides an interactive interface to test API endpoints and view documentation. You can access the Swagger UI for this API at:

```
http://localhost:3000/
```

Navigate to this URL in your web browser to view all available endpoints, along with detailed information on request parameters and responses. You can also make test requests directly from the Swagger interface.

### cURL Requests

For command-line testing, you can use cURL to interact with the API.
Be aware that for most of the routes, you'll need a **J**son **W**eb **T**oken provided with the routes ([cf route](#post-endpoints)):

* POST  `/login/client`
* POST `/login/employe`

When you have the token, don't forget to add the header `Authorization: Bearer + <token>`.

Below are some examples of cURL requests you can use to test various endpoints:

1. **GET Request**

   ```sh
   curl -X GET "http://localhost:3000/your-endpoint" -H "accept: application/json"
   ```
2. **POST Request**

   ```sh
   curl -X POST "http://localhost:3000/your-endpoint" -H "accept: application/json" -H "Content-Type: application/json" -d '{"key1":"value1","key2":"value2"}'
   ```
3. **PUT Request**

   ```sh
   curl -X PUT "http://localhost:3000/your-endpoint/1" -H "accept: application/json" -H "Content-Type: application/json" -d '{"key1":"updatedValue"}'
   ```
4. **DELETE Request**

   ```sh
   curl -X DELETE "http://localhost:3000/your-endpoint/1" -H "accept: application/json"
   ```

Using these methods, you can comprehensively test the API to ensure it behaves as expected.

## Endpoints

### GET Endpoints

- **GET /users/** - Retrieve all users (clients and employees).
- **GET /users/operations** - Retrieve all clients operations.
- **GET /users/client** - Retrieve client details.
- **GET /users/client/:id** - Retrieve client details by client ID.
- **GET /users/employe** - Retrieve all employees.
- **GET /users/employe/:id** - Retrieve employee details by employee ID.

### POST Endpoints

- **POST /send-email** - Send a contact email to the employees.

```json
  {
      "subject": "Subject of email",
      "text": "Text format of email",
      "html": "HTML format of email" 
  }
```

- **POST /login/forgotpassword** - Forgot password process.

  The forgot password process takes place in two steps:

  ```json
  {
      "username": "example@domain.com",
      "type": "clients"
  }
  ```

  Then you will recieve an email containing an OTP code

  ```json
  {
      "username": "client@example.com",
      "password": "newPassw0rd",
      "otp": "1234",
      "type": "clients"
  }
  ```
- **POST /login/client** - Client login with credentials.

  ```json
  {
      "username": "example@domain.com",
      "password": "password123"
  }
  ```
- **POST /login/employe** - Employee login with credentials.

  ```json
  {
      "username": "0000000000",
      "password": "password123"
  }
  ```
- **POST /users/client/new** - Create a new client.
- ```json
  {
      "email": "client@example.com",
      "name": "John",
      "surname": "Doe",
      "password": "password123"
  }
  ```
- **POST /users/employe/new** - Create a new employee.

  ```json
  {
      "email": "employee@example.com",
      "name": "Jane",
      "surname": "Doe",
      "password": "password123",
      "role": "ADMIN",
      "clients": ["client_id_1", "client_id_2"]
  }
  ```
- **POST /users/client/virement** - Perform a virement operation.

  ```json
  {
      "from_iban": "FR0193717749601196862485542",
      "to_iban": "FR76virt4z5grd6z2szg8e5",
      "amount": 100,
      "libelle": "Rent Payment"
  }
  ```
- **POST /users/client/new/card** - Create a new card for a client.

  ```json
  {
      "ident": "client_id",
      "name": "Visa"
  }
  ```
- **POST /users/client/new/account** - Create a new account for a client.

  ```json
  {
      "ident": "client_id",
      "name": "Savings"
  }
  ```

### DELETE Endpoints

- **DELETE /users/client/:id** - Delete a client by ID.
- **DELETE /users/client/beneficiaire/:id** - Delete the IDth beneficiaire of the logged in client.
- **DELETE /users/employe/:id** - Delete an employee by ID.

### PUT Endpoints

- **PUT /users/client/:id** - Update client details.

  ```json
  {
      "surname": "UpdatedSurname",
      "name": "UpdatedName",
      "email": "updatedemail@example.com",
      "accounts": ["account_id_1", "account_id_2"],
      "cards": ["card_id_1", "card_id_2"]
  }
  ```
- **PUT /users/client/account/:id** - Update account details.

  ```json
  {
      "name": "UpdatedName",
      "iban": "UpdatedIban"
  }
  ```
- **PUT /users/client/beneficiaire/:id** - Update client beneficiaires.

  ```json
  {
      "name": "NewBeneficiaireName",
      "surname": "NewBeneficiaireSurname",
      "iban": "NewBeneficiaireIban",
      "account": "NewBeneficiaireAccountName"
  }
  ```
- **PUT /users/employe/:id** - Update employee details.

  ```json
  {
      "surname": "UpdatedSurname",
      "name": "UpdatedName",
      "email": "updatedemail@example.com",
      "role": "ADMIN",
      "clients": ["client_id_1", "client_id_2"]
  }

  ```

## Contributing

Firstly first, thanks to all the contributors:

- [Jean-Baptiste Beck](mailto:e2305083@etud.univ-ubs.fr) Main developer of the API
- [Corentin Bouijoux](mailto:e2304573@etud.univ-ubs.fr) Main developer of the front-end

We welcome contributions to improve the Virtuella API. To contribute, please follow these steps:

1. Fork the repository.
2. Create a new branch:
   ```sh
   git checkout -b feature/your-feature-name
   ```
3. Make your changes and commit them:
   ```sh
   git commit -m "Add your commit message"
   ```
4. Push to the branch:
   ```sh
   git push origin feature/your-feature-name
   ```
5. Open a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for more information.

---

For further details, please refer to the in-code comments and the provided examples in the codebase. If you have any questions or issues, feel free to open an issue in the repository.
