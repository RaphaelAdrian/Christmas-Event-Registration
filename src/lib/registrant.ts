import { event } from "@/config/event";

/** Outcomes of the database's resolve_registrant() / register_attendee() checks. */
export type RegistrantOutcome =
  | "INVITED"
  | "NEW"
  | "NOT_INVITED"
  | "ALREADY_REGISTERED"
  | "CANCELLED"
  | "AMBIGUOUS_NAME"
  | "DUPLICATE_EMAIL"
  | "NAME_REQUIRED";

/** What to tell the person, and which field the message belongs under. Never reveals anyone else's details. */
export function outcomeMessage(outcome: string): { field: "firstName" | "lastName" | "email"; message: string } | null {
  const write = event.contact.email;
  switch (outcome) {
    case "NOT_INVITED":
      return {
        field: "lastName",
        message: `We can't find this name on the invite list. Use the first and last name on your invitation, or write to ${write}.`,
      };
    case "AMBIGUOUS_NAME":
      return {
        field: "firstName",
        message: "More than one invited guest matches this name. Type your first name in full, as on your invitation.",
      };
    case "ALREADY_REGISTERED":
      return {
        field: "lastName",
        message: `This name is already registered. To change the registration, write to ${write}.`,
      };
    case "CANCELLED":
      return {
        field: "lastName",
        message: `This invitation was cancelled. Write to ${write} if you think that's a mistake.`,
      };
    case "DUPLICATE_EMAIL":
      return {
        field: "email",
        message: `This email is already registered. To change your registration, write to ${write}.`,
      };
    case "NAME_REQUIRED":
      return { field: "firstName", message: "Enter your first and last name." };
    default:
      return null;
  }
}
