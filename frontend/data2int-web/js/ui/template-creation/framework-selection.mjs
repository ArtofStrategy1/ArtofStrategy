import { templateConfig } from "./template-config.mjs";
import { appState } from "../../state/app-state.mjs";
import { dom } from "../../utils/dom-utils.mjs";

function frameworkCheckboxChangeHandler() {
    const checkedBoxes = document.querySelectorAll("#frameworkList .method-checkbox:checked");
    const selectionCounter = dom.$("selectionCounter");

    if (checkedBoxes.length > appState.currentSelectionLimit) {
        this.checked = false;
    }

    const finalCheckedCount = document.querySelectorAll("#frameworkList .method-checkbox:checked").length;
    if (selectionCounter) {
        selectionCounter.textContent = `Selected: ${finalCheckedCount} / ${appState.currentSelectionLimit}`;
    }
}



function configureFrameworkSelector(limit) {
    appState.currentSelectionLimit = limit;
    const selectionCounter = dom.$("selectionCounter");
    const checkboxes = document.querySelectorAll("#frameworkList .method-checkbox");

    if (!selectionCounter || !checkboxes) return;

    selectionCounter.textContent = `Selected: 0 / ${limit}`;

    const rule = templateConfig.templateRules[appState.currentTemplateId] || {};
    if (!rule.preselectFramework) {
        checkboxes.forEach((cb) => {
            cb.checked = false;
        });
    }
    frameworkCheckboxChangeHandler();
}



function getSelectedFrameworks() {
    const checkedBoxes = document.querySelectorAll("#frameworkList .method-checkbox:checked");
    const selectedMethods = [];

    const frameworkMap = {
        "Reframing Thinking": "ReframingThinking",
        "Delphi Method": "DelphiMethod",
        "Blue Ocean Strategy": "BlueOcean",
        "Design Thinking": "DesignThinking",
        "Thinking Hats": "ThinkingHats",
        "Business Model Canvas": "BusinessModelCanvas",
        SCAMPER: "SCAMPER",
        "TRIZ (Theory of Inventive Problem Solving)": "TRIZ"
    };

    checkedBoxes.forEach((checkbox) => {
        const methodText = checkbox.dataset.framework;
        if (frameworkMap[methodText]) {
            selectedMethods.push(frameworkMap[methodText]);
        }
    });
    return selectedMethods.join(",");
}



function getSelectedSections() {
    const checkedBoxes = document.querySelectorAll("#analysisList .method-checkbox:checked");
    const sectionMap = {
        Introduction: "introduction",
        "Overview of business": "overview_of_business",
        "process overview": "process_overview",
        "mission statement": "mission_statement",
        "vision analysis": "vision_analysis",
        "vision statement 2": "vision_statement_2",
        "novel strategy part 1": "novel_strategy_part_1",
        "novel strategy part 2": "novel_strategy_part_2",
        "novel strategy part 3": "novel_strategy_part_3"
    };

    if (checkedBoxes.length === 0) {
        return Object.values(sectionMap).join(",");
    }

    const selectedSections = [];
    checkedBoxes.forEach((checkbox) => {
        const sectionText = checkbox.nextElementSibling.textContent.trim();
        if (sectionMap[sectionText]) {
            selectedSections.push(sectionMap[sectionText]);
        }
    });
    return selectedSections.join(",");
}



function getFrameworkForTemplate(templateId) {
    const selectedFrameworks = getSelectedFrameworks();
    return selectedFrameworks || "BlueOcean,SCAMPER";
}


export {
    frameworkCheckboxChangeHandler,
    configureFrameworkSelector,
    getSelectedFrameworks,
    getSelectedSections,
    getFrameworkForTemplate
}