// ============================================================
// ALBERT CORE V1.1
// Zentrale Steuerung des Albert Intelligence Network
// ============================================================

const radar = require("../divisions/radar");
const cipher = require("../divisions/cipher");
const oracle = require("../divisions/oracle");
const quantum = require("../divisions/quantum");
const verdict = require("../divisions/verdict");

const Albert = {

  name: "ALBERT",
  version: "1.1",

  description:
    "Zentrale Steuerungsintelligenz des Albert Intelligence Network",

  divisions: {
    RADAR: radar,
    CIPHER: cipher,
    ORACLE: oracle,
    QUANTUM: quantum,
    VERDICT: verdict
  },

  // ----------------------------------------------------------
  // DIVISIONEN
  // ----------------------------------------------------------

  getDivisions() {
    return Object.keys(this.divisions);
  },

  getDivision(name) {
    return this.divisions[name?.toUpperCase()] || null;
  },

  // ----------------------------------------------------------
  // SYSTEMSTATUS
  // ----------------------------------------------------------

  getStatus() {

    const divisionStatus = {};

    for (const [name, division] of Object.entries(this.divisions)) {
      divisionStatus[name] = {
        available: Boolean(division),
        executable: typeof division?.execute === "function"
      };
    }

    const allExecutable = Object.values(divisionStatus)
      .every(division => division.executable);

    return {
      system: this.name,
      version: this.version,
      divisions: divisionStatus,
      status: allExecutable
        ? "READY"
        : "MODULES_INCOMPLETE"
    };
  },

  // ----------------------------------------------------------
  // EINE DIVISION AUSFÜHREN
  // ----------------------------------------------------------

  async executeDivision(name, input) {

    const division = this.getDivision(name);

    if (!division) {
      throw new Error(`Division ${name} existiert nicht.`);
    }

    if (typeof division.execute !== "function") {
      throw new Error(
        `Division ${name} besitzt noch keine execute()-Funktion.`
      );
    }

    console.log(`[ALBERT] Starte ${name}`);

    const startedAt = Date.now();

    const result = await division.execute(input);

    console.log(
      `[ALBERT] ${name} abgeschlossen in ${Date.now() - startedAt} ms`
    );

    return result;
  },

  // ----------------------------------------------------------
  // ALLE FÜNF DIVISIONEN AUSFÜHREN
  // ----------------------------------------------------------

  async run(input = {}) {

    console.log("[ALBERT] Starte Intelligence Pipeline");

    const results = {};
    const executionLog = [];

    let currentInput = input;

    for (const name of this.getDivisions()) {

      const startedAt = Date.now();

      try {

        const result = await this.executeDivision(
          name,
          currentInput
        );

        results[name] = result;

        executionLog.push({
          division: name,
          status: "completed",
          duration_ms: Date.now() - startedAt
        });

        currentInput = {
          ...currentInput,
          ...result,
          previousDivision: name,
          pipelineResults: { ...results }
        };

      } catch (error) {

        executionLog.push({
          division: name,
          status: "failed",
          error: error.message,
          duration_ms: Date.now() - startedAt
        });

        console.error(
          `[ALBERT] Fehler in ${name}:`,
          error.message
        );

        return {
          success: false,
          failedDivision: name,
          results,
          executionLog
        };
      }
    }

    console.log("[ALBERT] Pipeline abgeschlossen");

    return {
      success: true,
      results,
      executionLog
    };
  }
};

module.exports = Albert;
