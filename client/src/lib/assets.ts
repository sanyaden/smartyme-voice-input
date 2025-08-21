// Asset management for images and other resources

// Mr. Smart avatar
export const mrSmartImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%234F46E5'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.35em' fill='white' font-size='40' font-weight='bold'%3EMS%3C/text%3E%3C/svg%3E";

// Get scenario-specific image
export function getScenarioImage(scenarioTitle: string): string {
  // Return a default or scenario-specific image
  // For now, return a placeholder
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 150'%3E%3Crect width='200' height='150' fill='%23E5E7EB'/%3E%3Ctext x='100' y='75' text-anchor='middle' dy='.35em' fill='%236B7280' font-size='14'%3E${encodeURIComponent(scenarioTitle)}%3C/text%3E%3C/svg%3E`;
}