import json
import sys
import yaml
import anthropic
from agent.prompts.system_prompt import build_system_prompt
from agent.tools import TOOL_DEFINITIONS, execute_tool
from profiles.teammate_store import TeammateStore
from profiles.iq_tracker import IQTracker
from config.settings import MODEL, USE_SUPABASE


class CIPGuardOrchestrator:
    def __init__(self, domain_name: str, teammate_store=None):
        self.client = anthropic.Anthropic()
        self.model = MODEL
        self.domain_name = domain_name
        self.domain_config = self._load_domain_config()
        if teammate_store is not None:
            self.teammate_store = teammate_store
        elif USE_SUPABASE:
            from profiles.supabase_store import SupabaseTeammateStore
            from config.settings import SUPABASE_URL, SUPABASE_SERVICE_KEY
            self.teammate_store = SupabaseTeammateStore(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        else:
            self.teammate_store = TeammateStore()
        self.iq_tracker = IQTracker(self.teammate_store)
        self.conversation_history = []

    def _load_domain_config(self) -> dict:
        with open(f"domains/{self.domain_name}/domain_config.yaml") as f:
            return yaml.safe_load(f)

    def run_session(self, teammate_id: str, teammate_name: str = None):
        profile = self.teammate_store.get_or_create(
            teammate_id, name=teammate_name, domain=self.domain_name
        )
        system_prompt = build_system_prompt(self.domain_config, profile)

        agent_name = self.domain_config["identity"]["agent_name"]
        domain_name = self.domain_config["domain"]["name"]
        iq_display = profile.get("iq_score", "Not yet assessed")

        print(f"\n{'='*60}")
        print(f"  {agent_name}")
        print(f"  Domain: {domain_name}")
        print(f"  Teammate: {profile['name']}")
        print(f"  Current IQ: {iq_display}")
        print(f"{'='*60}")
        print(f"\nType 'exit' or 'quit' to end the session.")
        print(f"Type 'status' to see your current IQ summary.\n")

        if profile.get("interaction_count", 0) == 0:
            print(f"Welcome! This is your first session. I'll start by getting to know")
            print(f"your current {domain_name} knowledge level.\n")

        while True:
            try:
                user_input = input("You: ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n\nSession ended.")
                break

            if not user_input:
                continue
            if user_input.lower() in ("exit", "quit"):
                print("\nSession ended. Your progress has been saved.")
                break
            if user_input.lower() == "status":
                self._show_status(teammate_id)
                continue

            self.conversation_history.append({"role": "user", "content": user_input})

            profile = self.teammate_store.get(teammate_id)
            system_prompt = build_system_prompt(self.domain_config, profile)

            response = self._agent_turn(system_prompt)
            print(f"\nTrainer: {response}\n")

            self.teammate_store.increment_interaction(teammate_id)

    def process_message(self, teammate_id: str, message: str) -> str:
        profile = self.teammate_store.get_or_create(teammate_id, domain=self.domain_name)
        system_prompt = build_system_prompt(self.domain_config, profile)

        self.conversation_history.append({"role": "user", "content": message})
        response = self._agent_turn(system_prompt)
        self.teammate_store.increment_interaction(teammate_id)
        return response

    def _agent_turn(self, system_prompt: str) -> str:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,
            tools=TOOL_DEFINITIONS,
            messages=self.conversation_history,
        )

        while response.stop_reason == "tool_use":
            tool_blocks = [b for b in response.content if b.type == "tool_use"]
            tool_results = []
            for tool_block in tool_blocks:
                print(f"  [Using tool: {tool_block.name}]")
                result = execute_tool(tool_block.name, tool_block.input)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_block.id,
                        "content": json.dumps(result),
                    }
                )

            self.conversation_history.append(
                {"role": "assistant", "content": response.content}
            )
            self.conversation_history.append(
                {"role": "user", "content": tool_results}
            )

            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=system_prompt,
                tools=TOOL_DEFINITIONS,
                messages=self.conversation_history,
            )

        assistant_text = "".join(
            b.text for b in response.content if hasattr(b, "text")
        )
        self.conversation_history.append(
            {"role": "assistant", "content": assistant_text}
        )

        return assistant_text

    def _show_status(self, teammate_id: str):
        summary = self.iq_tracker.get_iq_summary(teammate_id)
        print(f"\n{'─'*40}")
        print(f"  IQ Summary")
        print(f"{'─'*40}")
        print(f"  Overall IQ: {summary.get('overall', 'Not assessed')}")
        print(f"  Interactions: {summary.get('interaction_count', 0)}")

        per_standard = summary.get("per_standard", {})
        if per_standard:
            print(f"\n  Per-Standard Scores:")
            for std_id, score in sorted(per_standard.items()):
                bar = "█" * int(score / 5) + "░" * (20 - int(score / 5))
                print(f"    {std_id}: {bar} {score:.0f}")

        strengths = summary.get("strengths", [])
        if strengths:
            print(f"\n  Strengths: {', '.join(strengths)}")

        gaps = summary.get("gaps", [])
        if gaps:
            print(f"  Gaps: {', '.join(gaps)}")

        print(f"{'─'*40}\n")
