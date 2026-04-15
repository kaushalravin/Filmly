import { Route, Routes, BrowserRouter, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import PublicOnlyRoute from "./components/PublicOnlyRoute.jsx";
import Login from './components/Login.jsx';
import Signup from './components/Signup.jsx';

function DashboardPlaceholder() {
  return <div style={{ color: "white", padding: "2rem" }}>Dashboard page</div>;
}

function App() {
  

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Navigate to='/auth/login' replace />}></Route>
          <Route path='/auth/login' element={<PublicOnlyRoute><Login/></PublicOnlyRoute>}></Route>
          <Route path='/auth/signup' element={<PublicOnlyRoute><Signup/></PublicOnlyRoute>}></Route>
          <Route path='/dashboard' element={<ProtectedRoute><DashboardPlaceholder/></ProtectedRoute>}></Route>
          <Route path='*' element={<Navigate to='/auth/login' replace />}></Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App