cmake_minimum_required(VERSION 3.22)
project(llamajni C CXX)
set(CMAKE_CXX_STANDARD 17)

# llama.cpp at tag v0.5.0 (7fe450e1), the same tree node-llama-cpp 3.22.1 ships
set(LLAMA_SRC ${CMAKE_CURRENT_LIST_DIR}/llama.cpp)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_APP OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL OFF CACHE BOOL "" FORCE)
set(LLAMA_OPENSSL OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(GGML_LLAMAFILE OFF CACHE BOOL "" FORCE)
# shortcut: one fixed CPU target (dotprod+fp16, every arm64 phone since ~2018); use GGML_CPU_ALL_VARIANTS+GGML_BACKEND_DL if old phones matter
set(GGML_CPU_ARM_ARCH "armv8.2-a+dotprod+fp16" CACHE STRING "" FORCE)
add_subdirectory(${LLAMA_SRC} build-llama)

add_library(llamajni SHARED llamajni.cpp)
target_link_libraries(llamajni llama log)
