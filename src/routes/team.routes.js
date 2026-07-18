// src/routes/team.routes.js
const express = require('express');
const teamRouter = express.Router();

const {
  getTeamOverview,
  getTeamLevel,
  getAdminNetworkLeaders,
  getAdminTeamLevel
} = require('../controllers/team.controller');
const { requireAuth } = require('../middleware/auth.middleware');

teamRouter.get('/overview', requireAuth, getTeamOverview);
teamRouter.get('/level', requireAuth, getTeamLevel);

teamRouter.get('/admin/leaders', getAdminNetworkLeaders);
teamRouter.get('/admin/level/:userId', getAdminTeamLevel);

module.exports = teamRouter;
