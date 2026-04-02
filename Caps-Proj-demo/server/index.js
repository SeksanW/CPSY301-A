const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const cocRoutes = require('./routes/coc');
const sampleRoutes = require('./routes/samples');
const resultRoutes = require('./routes/results');

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/coc', cocRoutes);
app.use('/api/samples', sampleRoutes);
app.use('/api/results', resultRoutes);

app.get('/', (req, res) => res.send('ARIS LIMS API running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
