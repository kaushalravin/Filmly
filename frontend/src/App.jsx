import { Route, Routes, BrowserRouter, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import PublicOnlyRoute from "./components/PublicOnlyRoute.jsx";
import Login from './components/Login.jsx';
import Signup from './components/Signup.jsx';
import Dashboard from './components/Dashboard.jsx';



function App() {
  

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Navigate to='/auth/login' replace />}></Route>
          <Route path='/auth/login' element={<Login/>}></Route>
          <Route path='/auth/signup' element={<PublicOnlyRoute><Signup/></PublicOnlyRoute>}></Route>
          <Route path='/dashboard' element={<ProtectedRoute><Dashboard/></ProtectedRoute>}></Route>
          <Route path='*' element={<Navigate to='/auth/login' replace />}></Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App