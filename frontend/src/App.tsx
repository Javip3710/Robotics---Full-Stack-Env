import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import { RequireApproved, RequireAuth, RequirePermission } from "./auth/guards";
import PublicLayout from "./layouts/PublicLayout";
import PortalLayout from "./layouts/PortalLayout";
import Home from "./pages/Home";
import About from "./pages/About";
import DocsIndex from "./pages/DocsIndex";
import DocDetail from "./pages/DocDetail";
import NewsDetail from "./pages/NewsDetail";
import SignIn from "./pages/SignIn";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import ScoutingSubmit from "./pages/ScoutingSubmit";
import ScoutingResults, { SubmissionDetail } from "./pages/ScoutingResults";
import ScoutingTemplates from "./pages/ScoutingTemplates";
import Inventory from "./pages/Inventory";
import InventoryItemDetail from "./pages/InventoryItemDetail";
import NewsEditor from "./pages/NewsEditor";
import Events from "./pages/Events";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public website */}
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="docs" element={<DocsIndex />} />
            <Route path="docs/:slug" element={<DocDetail />} />
            <Route path="news/:id" element={<NewsDetail />} />
            <Route path="signin" element={<SignIn />} />
          </Route>

          {/* Signed-in portal */}
          <Route
            path="/app"
            element={
              <RequireAuth>
                <PortalLayout />
              </RequireAuth>
            }
          >
            <Route path="docs" element={<DocsIndex internal />} />
            <Route path="docs/:slug" element={<DocDetail internal />} />
            <Route
              path="news/new"
              element={
                <RequirePermission action="publish_news">
                  <NewsEditor />
                </RequirePermission>
              }
            />
            <Route index element={<Dashboard />} />
            <Route path="events" element={<RequirePermission action="manage_events"><Events /></RequirePermission>} />
            <Route
              path="members"
              element={
                <RequireApproved>
                  <Members />
                </RequireApproved>
              }
            />
            <Route
              path="news/:id/edit"
              element={
                <RequirePermission action="publish_news">
                  <NewsEditor />
                </RequirePermission>
              }
            />
            <Route
              path="scouting"
              element={
                <RequireApproved>
                  <ScoutingSubmit />
                </RequireApproved>
              }
            />
            <Route
              path="scouting/results"
              element={
                <RequireApproved>
                  <ScoutingResults />
                </RequireApproved>
              }
            />
            <Route
              path="scouting/results/:id"
              element={
                <RequireApproved>
                  <SubmissionDetail />
                </RequireApproved>
              }
            />
            <Route
              path="scouting/templates"
              element={
                <RequirePermission action="manage_scouting_templates">
                  <ScoutingTemplates />
                </RequirePermission>
              }
            />
            <Route
              path="inventory"
              element={
                <RequirePermission action="inventory">
                  <Inventory />
                </RequirePermission>
              }
            />
            <Route
              path="inventory/:itemId"
              element={
                <RequirePermission action="inventory">
                  <InventoryItemDetail />
                </RequirePermission>
              }
            />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
