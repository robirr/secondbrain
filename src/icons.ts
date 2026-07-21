import {
  BrainCircuit, Database, Sparkles, Workflow, Library, Scale, Smile, Plug, Wrench,
  BookOpen, Rocket, Briefcase, Landmark, HeartPulse, Users, Lightbulb, Flower2, Plane, Grip,
  Box, HardDrive, Mail, Calendar, GitBranch, FileText, MessageSquare, Circle, Asterisk,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const ICONS: Record<string, LucideIcon> = {
  brain: BrainCircuit, database: Database, sparkles: Sparkles, workflow: Workflow, library: Library,
  scale: Scale, smile: Smile, plug: Plug, wrench: Wrench, 'book-open': BookOpen, rocket: Rocket,
  briefcase: Briefcase, landmark: Landmark, 'heart-pulse': HeartPulse, users: Users, lightbulb: Lightbulb,
  flower: Flower2, plane: Plane, grip: Grip, box: Box, 'hard-drive': HardDrive, mail: Mail,
  calendar: Calendar, github: GitBranch, 'file-text': FileText, 'message-square': MessageSquare,
  circle: Circle, asterisk: Asterisk,
}

export const getIcon = (key: string): LucideIcon => ICONS[key] ?? Circle
