const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 5050;

// Define the path to the users.json file, clients.json file, and invoice.json file
const usersFilePath = path.join(__dirname, "users.json");
const clientsFilePath = path.join(__dirname, "clients.json");
const invoiceFilePath = path.join(__dirname, "invoice.json");

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, "your_jwt_secret_key");
    req.user = decoded; // Attach user information to request object
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

// Function to read data from a JSON file
const readData = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const data = fs.readFileSync(filePath, "utf8");
  if (!data.trim()) {
    return [];
  }
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error parsing file: ${filePath}`, error);
    return [];
  }
};

// Function to write data to a JSON file
const writeData = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
};

// Function to generate a unique ID
const generateId = () => "_" + Math.random().toString(36).substr(2, 9);

// POST endpoint for registration
app.post("/register", (req, res) => {
  const { email, password, firstname, lastname, gender } = req.body;

  // Check if the user already exists
  const users = readData(usersFilePath);
  const userExists = users.find((u) => u.email === email);

  if (userExists) {
    return res.status(400).json({ message: "User already exists" });
  }

  // Hash the password
  const hashedPassword = bcrypt.hashSync(password, 8);

  // Generate unique user ID
  const userId = generateId();

  // Save the user
  const newUser = {
    id: userId,
    email,
    password: hashedPassword,
    firstname,
    lastname,
    gender,
  };
  users.push(newUser);
  writeData(usersFilePath, users);

  res.status(201).json({ message: "User registered successfully", userId });
});

// POST endpoint for login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const users = readData(usersFilePath);
  const user = users.find((u) => u.email === email);

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  // Generate JWT token
  const token = jwt.sign(
    { email: user.email, id: user.id },
    "your_jwt_secret_key",
    {
      expiresIn: "1h",
    }
  );

  res.status(200).json({ token });
});

// POST endpoint to add client data
app.post("/add-client", authenticateToken, (req, res) => {
  const { id: userId } = req.user;

  const { email, name, companyName, companyEmail, companyAddress, gstNumber } =
    req.body;

  const clientId = generateId();
  const clientData = {
    id: clientId,
    userId,
    email,
    name,
    companyName,
    companyEmail,
    companyAddress,
    gstNumber,
  };

  // Read existing clients
  const clients = readData(clientsFilePath);
  clients.push(clientData);
  writeData(clientsFilePath, clients);

  res.status(201).json({ message: "Client added successfully" });
});

// POST endpoint to add invoice data
app.post("/add-invoice", authenticateToken, (req, res) => {
  const { id: userId } = req.user;

  const { invoiceDate, invoiceNumber, invoiceDueDate, clientId, items } =
    req.body;

  const invoiceId = generateId();
  const invoiceData = {
    id: invoiceId,
    userId,
    invoiceDate,
    invoiceNumber,
    invoiceDueDate,
    clientId,
    items,
  };

  // Read existing invoices
  const invoices = readData(invoiceFilePath);
  invoices.push(invoiceData);
  writeData(invoiceFilePath, invoices);

  res.status(201).json({ message: "Invoice added successfully" });
});

// GET endpoint to fetch clients for the logged-in user
app.get("/clients", authenticateToken, (req, res) => {
  const userId = req.user.id; // Extract user ID from authenticated request
  const clients = readData(clientsFilePath);
  const userClients = clients.filter((client) => client.userId === userId);
  res.json(userClients);
});

// GET endpoint to fetch all invoices
// GET endpoint to fetch invoices for the logged-in user
app.get("/user-invoices", authenticateToken, (req, res) => {
  const userId = req.user.id; // Extract user ID from authenticated request
  const invoices = readData(invoiceFilePath);
  const userInvoices = invoices.filter((invoice) => invoice.userId === userId);
  res.json(userInvoices);
});

// DELETE endpoint to delete a client by ID
app.delete("/delete-client/:id", authenticateToken, (req, res) => {
  const { id: clientId } = req.params;
  const userId = req.user.id;

  let clients = readData(clientsFilePath);
  const clientIndex = clients.findIndex(
    (client) => client.id === clientId && client.userId === userId
  );

  if (clientIndex === -1) {
    return res
      .status(404)
      .json({ message: "Client not found or unauthorized" });
  }

  clients.splice(clientIndex, 1);
  writeData(clientsFilePath, clients);

  res.status(200).json({ message: "Client deleted successfully" });
});

// PUT endpoint to update a client by ID
app.put("/update-client/:id", authenticateToken, (req, res) => {
  const { id: clientId } = req.params;
  const userId = req.user.id;

  let clients = readData(clientsFilePath);
  const clientIndex = clients.findIndex(
    (client) => client.id === clientId && client.userId === userId
  );

  if (clientIndex === -1) {
    return res
      .status(404)
      .json({ message: "Client not found or unauthorized" });
  }

  const { email, name, companyName, companyEmail, companyAddress, gstNumber } =
    req.body;
  clients[clientIndex] = {
    ...clients[clientIndex],
    email,
    name,
    companyName,
    companyEmail,
    companyAddress,
    gstNumber,
  };

  writeData(clientsFilePath, clients);

  res.status(200).json({ message: "Client updated successfully" });
});
// PUT endpoint to update an invoice by ID
app.put("/update-invoice/:id", authenticateToken, (req, res) => {
  const { id: invoiceId } = req.params;
  const userId = req.user.id;

  let invoices = readData(invoiceFilePath);
  const invoiceIndex = invoices.findIndex(
    (invoice) => invoice.id === invoiceId && invoice.userId === userId
  );

  if (invoiceIndex === -1) {
    return res
      .status(404)
      .json({ message: "Invoice not found or unauthorized" });
  }

  const { invoiceDate, invoiceNumber, invoiceDueDate, clientId, items } =
    req.body;
  invoices[invoiceIndex] = {
    ...invoices[invoiceIndex],
    invoiceDate,
    invoiceNumber,
    invoiceDueDate,
    clientId,
    items,
  };

  writeData(invoiceFilePath, invoices);

  res.status(200).json({ message: "Invoice updated successfully" });
});

// DELETE endpoint to delete an invoice by ID
app.delete("/delete-invoice/:id", authenticateToken, (req, res) => {
  const { id: invoiceId } = req.params;
  const userId = req.user.id;

  let invoices = readData(invoiceFilePath);
  const invoiceIndex = invoices.findIndex(
    (invoice) => invoice.id === invoiceId && invoice.userId === userId
  );

  if (invoiceIndex === -1) {
    return res
      .status(404)
      .json({ message: "Invoice not found or unauthorized" });
  }

  invoices.splice(invoiceIndex, 1);
  writeData(invoiceFilePath, invoices);

  res.status(200).json({ message: "Invoice deleted successfully" });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
