// src/routes/team.routes.js
const express = require('express');
const teamRouter = express.Router();

const {
  getTeamOverview,
  getTeamLevel
} = require('../controllers/team.controller');
const { requireAuth } = require('../middleware/auth.middleware');

teamRouter.get('/overview', requireAuth, getTeamOverview);
teamRouter.get('/level', requireAuth, getTeamLevel);

module.exports = teamRouter;
