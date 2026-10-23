from enum import Enum
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional

class ParameterDomain(str, Enum):
    WORLD = "world"
    ECONOMY = "economy"
    POPULATION = "population"
    SOCIAL = "social"
    AGENTS = "agents"
    TECHNOLOGY = "technology"
    ENVIRONMENT = "environment"

class ParameterType(str, Enum):
    FLOAT = "float"
    INT = "int"
    BOOLEAN = "boolean"
    STRING = "string"

class ParameterDefinition(BaseModel):
    id: str
    domain: ParameterDomain
    label: str
    description: str
    datatype: ParameterType
    default_value: Any
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    allowed_operations: List[str] = Field(default_factory=lambda: ["set", "add", "multiply"])
    is_runtime_editable: bool = True

class CapabilityDefinition(BaseModel):
    id: str
    domain: ParameterDomain
    label: str
    description: str
    is_active_by_default: bool = False
    prerequisite_capabilities: List[str] = Field(default_factory=list)

class MechanismDefinition(BaseModel):
    id: str
    domain: ParameterDomain
    label: str
    description: str
    target_state_fields: List[str] = Field(default_factory=list)
    required_capabilities: List[str] = Field(default_factory=list)

class EventDefinition(BaseModel):
    id: str
    event_type: str
    domain: ParameterDomain
    label: str
    description: str
    mechanism_id: str
    allowed_operations: List[str] = Field(default_factory=lambda: ["set", "add", "multiply"])

class SimulationOntology:
    def __init__(self):
        self.parameters: Dict[str, ParameterDefinition] = {}
        self.capabilities: Dict[str, CapabilityDefinition] = {}
        self.mechanisms: Dict[str, MechanismDefinition] = {}
        self.events: Dict[str, EventDefinition] = {}
        self._initialize_registry()
        
    def _initialize_registry(self):
        # PARAMETERS
        self.register_parameter(ParameterDefinition(
            id="rainfall",
            domain=ParameterDomain.ENVIRONMENT,
            label="Rainfall Base",
            description="Base rainfall logic parameter.",
            datatype=ParameterType.FLOAT,
            default_value=1.0,
            min_value=0.0,
            max_value=5.0
        ))
        
        self.register_parameter(ParameterDefinition(
            id="mortality_rate",
            domain=ParameterDomain.POPULATION,
            label="Base Mortality Rate",
            description="Base chance of death by aging per tick.",
            datatype=ParameterType.FLOAT,
            default_value=0.001,
            min_value=0.0,
            max_value=1.0
        ))
        
        self.register_parameter(ParameterDefinition(
            id="crop_yield_multiplier",
            domain=ParameterDomain.ENVIRONMENT,
            label="Base Crop Yield Multiplier",
            description="Base crop yield for agricultural production.",
            datatype=ParameterType.FLOAT,
            default_value=1.0,
            min_value=0.0,
            max_value=5.0
        ))
        
        self.register_parameter(ParameterDefinition(
            id="infrastructure_multiplier",
            domain=ParameterDomain.ENVIRONMENT,
            label="Infrastructure Multiplier",
            description="Integrity of regional infrastructure for productivity.",
            datatype=ParameterType.FLOAT,
            default_value=1.0,
            min_value=0.0,
            max_value=1.0
        ))
        
        self.register_parameter(ParameterDefinition(
            id="progressivism",
            domain=ParameterDomain.WORLD,
            label="Cultural Progressivism",
            description="Zeitgeist of progressive vs traditional values.",
            datatype=ParameterType.FLOAT,
            default_value=0.5,
            min_value=0.0,
            max_value=1.0
        ))
        
        self.register_parameter(ParameterDefinition(
            id="authoritarianism",
            domain=ParameterDomain.WORLD,
            label="Cultural Authoritarianism",
            description="Zeitgeist of state control vs individual liberty.",
            datatype=ParameterType.FLOAT,
            default_value=0.5,
            min_value=0.0,
            max_value=1.0
        ))
        
        self.register_parameter(ParameterDefinition(
            id="religiosity",
            domain=ParameterDomain.WORLD,
            label="Cultural Religiosity",
            description="Overall religious zeal in the civilization.",
            datatype=ParameterType.FLOAT,
            default_value=0.5,
            min_value=0.0,
            max_value=1.0
        ))
        
        self.register_parameter(ParameterDefinition(
            id="trust_decay",
            domain=ParameterDomain.WORLD,
            label="Social Trust Decay",
            description="Rate at which interpersonal trust drops.",
            datatype=ParameterType.FLOAT,
            default_value=0.05,
            min_value=0.0,
            max_value=1.0
        ))

        # CAPABILITIES
        self.register_capability(CapabilityDefinition(
            id="electricity",
            domain=ParameterDomain.TECHNOLOGY,
            label="Electricity",
            description="Ability to generate and utilize electric power."
        ))
        
        self.register_capability(CapabilityDefinition(
            id="mechanized_production",
            domain=ParameterDomain.TECHNOLOGY,
            label="Mechanized Production",
            description="Industrial scale production.",
            prerequisite_capabilities=["electricity"]
        ))
        
        self.register_capability(CapabilityDefinition(
            id="irrigation",
            domain=ParameterDomain.TECHNOLOGY,
            label="Irrigation",
            description="Ability to redirect water for farming."
        ))

        # MECHANISMS
        self.register_mechanism(MechanismDefinition(
            id="production_process",
            domain=ParameterDomain.ECONOMY,
            label="Production Process",
            description="Mechanism driving how resources are converted into goods.",
            target_state_fields=["economy.production_output", "world.crop_yield_multiplier"]
        ))
        
        self.register_mechanism(MechanismDefinition(
            id="infrastructure_damage",
            domain=ParameterDomain.ENVIRONMENT,
            label="Infrastructure Damage",
            description="Mechanism reducing infrastructure integrity.",
            target_state_fields=["world.infrastructure_multiplier"]
        ))
        
        self.register_mechanism(MechanismDefinition(
            id="resource_activation",
            domain=ParameterDomain.ENVIRONMENT,
            label="Resource Activation",
            description="Mechanism making dormant deposits available.",
            target_state_fields=["world.resource_deposits"]
        ))
        
        self.register_mechanism(MechanismDefinition(
            id="migration_choice",
            domain=ParameterDomain.POPULATION,
            label="Migration Choice",
            description="Mechanism driving agent decisions to move settlements.",
            target_state_fields=["population.migration_events"]
        ))
        
        self.register_mechanism(MechanismDefinition(
            id="price_formation",
            domain=ParameterDomain.ECONOMY,
            label="Price Formation",
            description="Mechanism driving EMA price clearing in markets.",
            target_state_fields=["economy.prices"]
        ))
        
        self.register_mechanism(MechanismDefinition(
            id="reproduction",
            domain=ParameterDomain.POPULATION,
            label="Reproduction",
            description="Mechanism driving birth pipeline.",
            target_state_fields=["population.births"]
        ))

        # EVENTS
        self.register_event(EventDefinition(
            id="drought",
            event_type="natural_disaster",
            domain=ParameterDomain.ENVIRONMENT,
            label="Drought",
            description="Prolonged absence of rainfall affecting crop yields.",
            mechanism_id="production_process"
        ))
        
        self.register_event(EventDefinition(
            id="flood",
            event_type="natural_disaster",
            domain=ParameterDomain.ENVIRONMENT,
            label="Flood",
            description="Excessive water causing damage and yield reduction.",
            mechanism_id="production_process"
        ))
        
        self.register_event(EventDefinition(
            id="earthquake",
            event_type="natural_disaster",
            domain=ParameterDomain.ENVIRONMENT,
            label="Earthquake",
            description="Seismic event destroying infrastructure.",
            mechanism_id="infrastructure_damage"
        ))
        
        self.register_event(EventDefinition(
            id="resource_discovery",
            event_type="economic_boom",
            domain=ParameterDomain.ECONOMY,
            label="Resource Discovery",
            description="Sudden influx or availability of a raw resource.",
            mechanism_id="resource_activation"
        ))
        
    def register_parameter(self, param: ParameterDefinition):
        self.parameters[param.id] = param
        
    def register_capability(self, cap: CapabilityDefinition):
        self.capabilities[cap.id] = cap
        
    def register_mechanism(self, mech: MechanismDefinition):
        self.mechanisms[mech.id] = mech
        
    def register_event(self, event: EventDefinition):
        self.events[event.id] = event

    # Keep legacy get_parameter and get_all for frontend backward compatibility
    def get_parameter(self, param_id: str) -> Optional[ParameterDefinition]:
        return self.parameters.get(param_id)
        
    def get_all(self) -> List[ParameterDefinition]:
        return list(self.parameters.values())

# Global registry instance
registry = SimulationOntology()
