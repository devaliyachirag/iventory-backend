const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 5050;

// Define the path to the users.json file and clients.json file
const usersFilePath = path.join(__dirname, 'users.json');
const clientsFilePath = path.join(__dirname, 'clients.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Function to read users from the JSON file
const readUsers = () => {
  if (!fs.existsSync(usersFilePath)) {
    return [];
  }
  const usersData = fs.readFileSync(usersFilePath, 'utf8');
  if (!usersData.trim()) {
    return [];
  }
  try {
    return JSON.parse(usersData);
  } catch (error) {
    console.error('Error parsing users file:', error);
    return [];
  }
};

// Function to write users to the JSON file
const writeUsers = (users) => {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
};

// Function to read clients from the JSON file
const readClients = () => {
  if (!fs.existsSync(clientsFilePath)) {
    return [];
  }
  const clientsData = fs.readFileSync(clientsFilePath, 'utf8');
  if (!clientsData.trim()) {
    return [];
  }
  try {
    return JSON.parse(clientsData);
  } catch (error) {
    console.error('Error parsing clients file:', error);
    return [];
  }
};

// Function to write clients to the JSON file
const writeClients = (clients) => {
  fs.writeFileSync(clientsFilePath, JSON.stringify(clients, null, 2), 'utf8');
};

// Function to generate a unique ID
const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

// POST endpoint for registration
app.post('/register', (req, res) => {
  const { email, password, firstname, lastname, gender } = req.body;

  // Check if the user already exists
  const users = readUsers();
  const userExists = users.find(u => u.email === email);

  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  // Hash the password
  const hashedPassword = bcrypt.hashSync(password, 8);

  // Generate unique user ID
  const userId = generateId();

  // Save the user
  const newUser = { id: userId, email, password: hashedPassword, firstname, lastname, gender };
  users.push(newUser);
  writeUsers(users);

  res.status(201).json({ message: 'User registered successfully', userId });
});

// POST endpoint for login
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const users = readUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  // Generate JWT token
  const token = jwt.sign({ email: user.email, id: user.id }, 'your_jwt_secret_key', {
    expiresIn: '1h'
  });

  res.status(200).json({ token });
});

// POST endpoint to add client data
app.post('/add-client', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret_key');
    console.log('Decoded token:', decoded);

    const { id: userId } = decoded;

    const { email, name, companyName, companyEmail, companyAddress, gstNumber } = req.body;

    const clientId = generateId();
    const clientData = {
      id: clientId,
      userId,
      email,
      name,
      companyName,
      companyEmail,
      companyAddress,
      gstNumber
    };

    // Read existing clients
    const clients = readClients();
    clients.push(clientData);
    writeClients(clients);

    res.status(201).json({ message: 'Client added successfully' });
  } catch (error) {
    console.error('Error verifying token or adding client:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
