import CommandTrigger from "./command_trigger";
import Command from "./command";
import InteractableCommand from "./interactable_command";
import EconomyCommand from "./economy_command";
import ImageCommand from "./image_command";
import CommandHandlerStore from "./command_handler_store";

export const commandHandlerStore = CommandHandlerStore.instance;

export {
    CommandTrigger,
    Command,
    InteractableCommand,
    EconomyCommand,
    ImageCommand,
}