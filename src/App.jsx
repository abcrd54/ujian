import { Navigate, Route, Routes } from "react-router-dom";
import {
  RequireAuth,
  RequireRole,
  RequireWebRole,
  getDefaultPathByRole,
} from "./auth/guards";
import { AppLayout } from "./components/AppLayout";
import { useAuth } from "./auth/AuthContext";
import { navItems } from "./data/navigation";
import { ClassesPage } from "./pages/ClassesPage";
import { AccountsPage } from "./pages/AccountsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EssayGradingPage } from "./pages/EssayGradingPage";
import { ExamsPage } from "./pages/ExamsPage";
import { LoginPage } from "./pages/LoginPage";
import { QuestionAuthoringPage } from "./pages/QuestionAuthoringPage";
import { ResultsPage } from "./pages/ResultsPage";
import { ReviewQuestionsPage } from "./pages/ReviewQuestionsPage";
import { SchedulesPage } from "./pages/SchedulesPage";
import { SchoolAdminsPage } from "./pages/SchoolAdminsPage";
import { SchoolsPage } from "./pages/SchoolsPage";
import { StudentsPage } from "./pages/StudentsPage";
import { SubjectsPage } from "./pages/SubjectsPage";
import { TeachersPage } from "./pages/TeachersPage";

const routeComponents = {
  "/dashboard": DashboardPage,
  "/schools": SchoolsPage,
  "/school-admins": SchoolAdminsPage,
  "/accounts": AccountsPage,
  "/teachers": TeachersPage,
  "/students": StudentsPage,
  "/classes": ClassesPage,
  "/subjects": SubjectsPage,
  "/exams": ExamsPage,
  "/question-authoring": QuestionAuthoringPage,
  "/review-questions": ReviewQuestionsPage,
  "/essay-grading": EssayGradingPage,
  "/schedules": SchedulesPage,
  "/results": ResultsPage,
};

function App() {
  const { role } = useAuth();
  const defaultPath = getDefaultPathByRole(role);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <RequireWebRole>
              <AppLayout />
            </RequireWebRole>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to={defaultPath} replace />} />
        {navItems.map((item) => {
          const Page = routeComponents[item.path];
          return (
            <Route
              key={item.path}
              path={item.path}
              element={
                <RequireRole allowedRoles={item.roles}>
                  <Page />
                </RequireRole>
              }
            />
          );
        })}
      </Route>
      <Route path="*" element={<Navigate to={defaultPath} replace />} />
    </Routes>
  );
}

export default App;
