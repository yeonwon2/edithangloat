// DichTruyenPro Server

const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api', apiRoutes);

// Serve static frontend in production if built
const clientDist = path.join(__dirname, 'client/dist');
app.use(express.static(clientDist));

// Fallback handler for SPA
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, err => {
    if (err) {
      res.status(200).send('DichTruyenPro API Server is running. Client is running on Vite (http://localhost:5173).');
    }
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  🚀 DichTruyenPro Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
