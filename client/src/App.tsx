import { Route, Switch } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/lib/auth";
import { FunnelProvider } from "@/lib/funnelContext";
import HomePage from "@/pages/home";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import LeadDetailPage from "@/pages/lead-detail";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";
import TrainingPage from "@/pages/training";
import TrainingLevelPage from "@/pages/training-level";
import PartnerLanding from "@/pages/partner-landing";
import PartnerPresentation from "@/pages/partner-presentation";
import PartnerBreakdown from "@/pages/partner-breakdown";
import CalendarPage from "@/pages/calendar";
import NotFoundPage from "@/pages/not-found";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FunnelProvider>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/login" component={LoginPage} />
            <Route path="/register" component={RegisterPage} />
            <Route path="/dashboard/leads/:id" component={LeadDetailPage} />
            <Route path="/dashboard" component={DashboardPage} />
            <Route path="/calendar" component={CalendarPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/training/:levelId" component={TrainingLevelPage} />
            <Route path="/training" component={TrainingPage} />
            <Route path="/admin" component={AdminPage} />
            <Route path="/:slug/breakdown" component={PartnerBreakdown} />
            <Route path="/:slug/presentation" component={PartnerPresentation} />
            <Route path="/:slug" component={PartnerLanding} />
            <Route component={NotFoundPage} />
          </Switch>
        </FunnelProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
