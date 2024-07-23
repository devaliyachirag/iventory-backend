const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 5050;

const usersFilePath = path.join(__dirname, "users.json");
const clientsFilePath = path.join(__dirname, "clients.json");
const invoiceFilePath = path.join(__dirname, "invoice.json");
const companiesFilePath = path.join(__dirname, "companies.json");

app.use(cors());
app.use(bodyParser.json());

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, "your_jwt_secret_key");
    req.user = decoded; 
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

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

const writeData = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
};

const generateId = () => "_" + Math.random().toString(36).substr(2, 9);

app.post("/register", (req, res) => {
  const { email, password, firstname, lastname, gender } = req.body;

  const users = readData(usersFilePath);
  const userExists = users.find((u) => u.email === email);

  if (userExists) {
    return res.status(400).json({ message: "User already exists" });
  }

  const hashedPassword = bcrypt.hashSync(password, 8);

  const userId = generateId();

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

  const token = jwt.sign(
    { email: user.email, id: user.id },
    "your_jwt_secret_key",
    {
      expiresIn: "1h",
    }
  );

  res.status(200).json({ token });
});

app.post("/register-company", authenticateToken, (req, res) => {
  const { companyName, companyEmail, companyContactNo, address, gstNumber } = req.body;
  const { id: userId } = req.user;

  const companies = readData(companiesFilePath);
  const companyExists = companies.find((c) => c.userId === userId);

  if (companyExists) {
    return res.status(400).json({ message: "Company already registered" });
  }

  const companyId = generateId();

  const newCompany = {
    id: companyId,
    userId,
    companyName,
    companyEmail,
    companyContactNo,
    address,
    gstNumber,
  };
  companies.push(newCompany);
  writeData(companiesFilePath, companies);

  res.status(201).json({ message: "Company registered successfully" });
});

app.get("/company", authenticateToken, (req, res) => {
  const { id: userId } = req.user;
  const companies = readData(companiesFilePath);
  const userCompany = companies.find((company) => company.userId === userId);

  if (!userCompany) {
    return res.status(404).json({ message: "Company not found" }); 
  }

  res.json(userCompany);
});

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

  const clients = readData(clientsFilePath);
  clients.push(clientData);
  writeData(clientsFilePath, clients);

  res.status(201).json({ message: "Client added successfully" });
});

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

  const invoices = readData(invoiceFilePath);
  invoices.push(invoiceData);
  writeData(invoiceFilePath, invoices);

  res.status(201).json({ message: "Invoice added successfully" });
});

app.get("/clients", authenticateToken, (req, res) => {
  const userId = req.user.id; 
  const clients = readData(clientsFilePath);
  const userClients = clients.filter((client) => client.userId === userId);
  res.json(userClients);
});
app.get("/client/:id", authenticateToken, (req, res) => {
  const { id: clientId } = req.params;
  const userId = req.user.id;

  const clients = readData(clientsFilePath);
  const client = clients.find(
    (client) => client.id === clientId && client.userId === userId
  );

  if (!client) {
    return res.status(404).json({ message: "Client not found or unauthorized" });
  }

  res.json(client);
});

app.get("/user-invoices", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const invoices = readData(invoiceFilePath);
  const userInvoices = invoices.filter((invoice) => invoice.userId === userId);
  res.json(userInvoices);
});

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
app.get("/invoice/:id", authenticateToken, (req, res) => {
  const { id: invoiceId } = req.params;
  const userId = req.user.id;

  const invoices = readData(invoiceFilePath);
  const invoice = invoices.find(
    (invoice) => invoice.id === invoiceId && invoice.userId === userId
  );

  if (!invoice) {
    return res.status(404).json({ message: "Invoice not found or unauthorized" });
  }

  res.json(invoice);
});

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
