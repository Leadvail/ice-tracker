export const categoryMap = {
  'Information Gathering': {
     color: '#3b82f6', // blue
     items: [
        "Confirmation of previous actions", 
        "Confirmation of hazards", 
        "Confirmation of risk assessments", 
        "Confirmation of previous role assignments", 
        "Determine suitability and sufficiency of resources", 
        "Determine involvement of other agencies", 
        "Information gathering"
     ]
  },
  'Incident Evaluation': {
     color: '#f59e0b', // yellow
     items: [
        "Resource evaluation", 
        "Risk evaluation", 
        "Obtained professional advice to help evaluate", 
        "Evaluation of impact on the organisation and others"
     ]
  },
  'Objective Setting and Planning': {
     color: '#10b981', // green
     items: [
        "Confirm priority actions and objectives", 
        "Action planning", 
        "Safe systems of work"
     ]
  },
  'Command and Control': {
     color: '#8b5cf6', // purple
     items: [
        "Assuming command", 
        "Control of the incident", 
        "Effective command", 
        "Delegating spans of control", 
        "Use of command support", 
        "Crisis management"
     ]
  },
  'Communications': {
     color: '#ec4899', // pink
     items: [
        "Communication with people", 
        "Transmitting tactical mode", 
        "Senior officer briefing"
     ]
  },
  'Review': {
     color: '#06b6d4', // cyan
     items: [
        "Update of tactical mode", 
        "Review of risk assessment", 
        "Actively monitor the progress of activity against your plan"
     ]
  }
};

export const scoreDescriptions = {
  "Confirmation of previous actions": {
    1: "You failed to confirm the action taken to date was compliant with relevant legislation and protocols.",
    2: "You delayed in confirming the action taken to date was compliant with relevant legislation and protocols.",
    3: "You confirmed that the action taken to date was compliant with relevant legislation and protocols.",
    4: "You clearly confirmed that the action taken to date was compliant with relevant legislation and protocols."
  },
  "Confirmation of hazards": {
    1: "You failed to confirm what current hazards had already been identified, prior to your arrival.",
    2: "You were slow to confirm what current hazards had already been identified, prior to your arrival.",
    3: "You confirmed the current hazards which had been identified, prior to your arrival.",
    4: "You clearly confirmed the current hazards which had been identified, prior on your arrival."
  },
  "Confirmation of risk assessments": {
    1: "You did not confirm if an Appropriate Risk Assessment was carried out.",
    2: "You delayed in confirming if an Appropriate Risk Assessment was carried out.",
    3: "You confirmed if an Appropriate Risk Assessment was carried out.",
    4: "You confirmed that an Appropriate Risk Assessment was carried out at the most appropriate time."
  },
  "Confirmation of previous role assignments": {
    1: "You did not confirm any of the previous assigned roles, which were assigned prior to your arrival.",
    2: "You delayed in confirming the previously assigned roles, which were assigned prior to your arrival.",
    3: "You confirmed the previously assigned roles, which were assigned prior to your arrival.",
    4: "You were prompt in confirming the previously assigned roles, which were assigned prior to your arrival."
  },
  "Determine suitability and sufficiency of resources": {
    1: "You did not determine the sufficiency and suitability of the resources already in attendance at the incident.",
    2: "You incorrectly determined the sufficiency and suitability of the resources already in attendance at the incident.",
    3: "You correctly determined the sufficiency and suitability of the resources already in attendance.",
    4: "You quickly and correctly determined the sufficiency and suitability of the resources already in attendance at the incident."
  },
  "Determine involvement of other agencies": {
    1: "You failed to determine the involvement of any other Agency at the incident.",
    2: "You delayed in determining the involvement of other Agencies at the incident.",
    3: "You determined the involvement of other Agencies at the incident.",
    4: "You quickly determined the involvement of other Agencies at the incident."
  },
  "Information gathering": {
    1: "You did not gather any information on the incident's progress, risks, deployment, resource availability and existing incident management.",
    2: "You were slow or failed to obtain sufficient information regarding the incident's progress, risks, deployment, resource availability and existing incident management.",
    3: "You obtained sufficient information on the incident's progress, risks, deployment, resource availability and existing incident management.",
    4: "You obtained sufficient information from all available sources on incident progress, risks, deployment, resource availability and existing incident management."
  },
  "Resource evaluation": {
    1: "You failed to anticipate any future resource needs and did not consider the possible escalation of incident.",
    2: "You were slow to anticipate any future resource needs.",
    3: "You anticipated the likely future resource needs, considering the possibility of an escalation of the incident.",
    4: "You anticipated and correctly identified the likely future resource needs, including the consideration of a possible escalation of the incident."
  },
  "Risk evaluation": {
    1: "You failed to anticipate the key risks to Health, Safety and Welfare and failed to ensure adequate and timely control measures were implemented.",
    2: "You were slow to anticipate the key risks to Health, Safety and Welfare and failed to ensure adequate and timely control measures were implemented.",
    3: "You anticipated the risks to Health, Safety and Welfare and ensured adequate and timely control measures were implemented.",
    4: "You clearly anticipated the Major risks to Health, Safety and Welfare, ensuring adequate and timely control measures were implemented."
  },
  "Obtained professional advice to help evaluate": {
    1: "You did not obtain any technical or professional advice from any source, which may have supported your decision making.",
    2: "You were slow to obtain any technical or professional advice from sources, which may have supported your decision making.",
    3: "You obtained technical and professional advice from suitable sources to help support your decision making.",
    4: "You were thorough in gaining technical / professional advice from suitable sources and used it to help support your decision making."
  },
  "Evaluation of impact on the organisation and others": {
    1: "You failed to evaluate the implications of the incident on the organisation, the environment, the local community and other agencies roles and responsibilities",
    2: "You evaluated the implications on most of the interested parties, which were involved with the incident.",
    3: "You evaluated the implications of the incident on the organisation, the environment, the local community and other agencies roles and responsibilities",
    4: "You evaluated and fully considered the implications of the incident on the organisation, the environment, the local community and other agencies roles and responsibilities"
  },
  "Confirm priority actions and objectives": {
    1: "After taking over you failed to confirm at any time, the objectives and priority actions for resolution of incident.",
    2: "After taking over you delayed in confirming the objectives and priority actions for resolution of incident.",
    3: "After taking over you confirmed the objectives and priority actions for resolution of incident.",
    4: "After taking over you were prompt and clear in confirming the objectives and priority actions for resolution of incident."
  },
  "Action planning": {
    1: "You formulated an inappropriate action plan to deal with the incident.",
    2: "You formulated an action plan, which fails to deploy the appropriate resources, or to effectively deal with a key dimension of the incident.",
    3: "You formulated an action plan, deploying the appropriate resources, which deal with the major elements of the incident.",
    4: "You formulated a comprehensive / flexible action plan, deploying the appropriate resources, which deal with all elements of the incident in a methodical way."
  },
  "Safe systems of work": {
    1: "You failed to employ a safe system of work.",
    2: "You employed inappropriate but safe systems of work.",
    3: "You employed an appropriate safe system of work, which is based upon consideration of the identified risks of the incident.",
    4: "You employed the most appropriate safe system of work, which is based upon full consideration of the identified risks of the incident."
  },
  "Assuming command": {
    1: "You failed to declare that you were assuming command.",
    2: "You assumed command without first gathering the appropriate information or at an inappropriate stage.",
    3: "You declared that you were assuming command having first gained some information.",
    4: "You declared that you were assuming command at the appropriate time, having first gathered all the necessary information."
  },
  "Control of the incident": {
    1: "You failed to establish firm control of the Incident.",
    2: "You failed to maintain control of the Incident.",
    3: "You maintained good control of the incident.",
    4: "You established / asserted effective control of the incident and maintained it throughout the incident."
  },
  "Effective command": {
    1: "You failed to establish firm command during the incident.",
    2: "You failed to maintain command or lost control of the Incident.",
    3: "You maintained good command qualities ensuring that you were constantly seen as being in command of the crew throughout the incident.",
    4: "You quickly established effective command of all crews / Sectors, displaying leadership."
  },
  "Delegating spans of control": {
    1: "You failed to consider delegating the span of control.",
    2: "You considered the span of control but failed to limit/sectorise appropriately.",
    3: "You accurately assessed the required span of control and assessed the need to limit/sectorise.",
    4: "You considered span of control and put in place an appropriate command structure in good time."
  },
  "Use of command support": {
    1: "You failed to use Command Support.",
    2: "You failed to use Command Support effectively.",
    3: "You established and interacted with Command Support effectively.",
    4: "You established and interacted with Command Support effectively, making full use of its resources."
  },
  "Crisis management": {
    1: "You failed to manage crisis situations.",
    2: "You were ineffective in managing a crisis situation.",
    3: "You managed crisis situations appropriately.",
    4: "You dealt with crisis situations efficiently in a calm controlled manner."
  },
  "Communication with people": {
    1: "You failed to establish effective communication with people.",
    2: "You established but failed to maintain effective communication with people.",
    3: "You established and maintained satisfactory communication with people.",
    4: "You established and maintained effective communication that is accurate, complete and using the correct methods of communication."
  },
  "Transmitting tactical mode": {
    1: "You failed to transmit the Tactical Mode of operation to any Personnel.",
    2: "You failed to transmit the Tactical Mode of Operation to All personnel.",
    3: "You transmitted the Tactical Mode of Operation to All Personnel.",
    4: "You transmitted the Tactical Mode of operation regularly and effectively to All personnel."
  },
  "Senior officer briefing": {
    1: "You failed to provide a senior officer briefing.",
    2: "You carried out a briefing of the senior officer, which lacked detail.",
    3: "You carried out a satisfactory senior officer briefing.",
    4: "You carried out a clear, concise, comprehensive and effective senior officer briefing."
  },
  "Update of tactical mode": {
    1: "You failed to update the Tactical Mode.",
    2: "You failed to update the Tactical Mode as required.",
    3: "You updated the Tactical Mode as required.",
    4: "You updated the Tactical Mode quickly and effectively."
  },
  "Review of risk assessment": {
    1: "You failed to review the Risk Assessment.",
    2: "You carried out an ineffective review of the Risk Assessment.",
    3: "You continually reviewed and modified the risk assessment to respond to changes.",
    4: "You continually reviewed and modified the risk assessment and rapidly responded to changes in the nature and extent of the incident."
  },
  "Actively monitor the progress of activity against your plan": {
    1: "You did not actively monitor the progress of activity during the incident against your plan.",
    2: "You did not adequately monitor the progress of activity during the incident to compare against your plan.",
    3: "You monitored the progress of activity during the incident and compared this against your plan.",
    4: "You continually monitored the progress of activity during the incident and compared and updated your plan where necessary."
  }
};
