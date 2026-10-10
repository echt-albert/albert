"use strict";
const { plan } = require("./strategy");
const { discover } = require("./discovery");
const { classify } = require("./filtering");
const { observation } = require("./learning");

/** Eigenständiger RADAR-Workflow. Bestehende UI/Jobs bleiben bis zur Integration unverändert. */
async function execute(input = {}, options = {}) {
  const strategy = plan(input);
  const response = await discover(strategy, options);
  const result = classify(response);
  return { ...result, researchResponse: response,
    observation: observation(strategy, result) };
}
module.exports = { execute, plan };
